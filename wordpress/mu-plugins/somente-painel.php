<?php
/**
 * O WordPress aqui é só painel: ninguém deve ver página dele no navegador.
 *
 * Quem abrir blog.wilsoncamposoficial.com.br cai no site de verdade. O
 * painel, o login e a API continuam funcionando normalmente — é a API que
 * alimenta o build do site e recebe o formulário de apoio.
 *
 * Fica em wp-content/mu-plugins/.
 */

if (!defined('ABSPATH')) {
    exit;
}

const WC_SITE_PUBLICO = 'https://wilsoncamposoficial.com.br';

/* ------------------------------------------------------------------ */
/* Frente do WordPress redireciona para o site                         */
/* ------------------------------------------------------------------ */

add_action('template_redirect', function () {
    /* painel, login, API e cron precisam continuar respondendo */
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }
    if (defined('REST_REQUEST') && REST_REQUEST) {
        return;
    }

    /* Se alguém tiver o link de um post no WordPress, manda para o mesmo
       post no site — em vez de jogar todo mundo na home. */
    if (is_singular('post')) {
        $destino = WC_SITE_PUBLICO . '/blog/' . get_post_field('post_name', get_queried_object_id()) . '/';
    } elseif (is_home() || is_archive() || is_search()) {
        $destino = WC_SITE_PUBLICO . '/blog/';
    } else {
        $destino = WC_SITE_PUBLICO . '/';
    }

    /* 302, não 301: um permanente ficaria gravado no navegador de quem
       acessou e seria um estorvo se um dia esse subdomínio mudar de uso. */
    wp_redirect($destino, 302);
    exit;
});

/* Arquivos de mídia (wp-content/uploads) não passam por aqui: o servidor
   entrega direto, sem PHP. As imagens dos posts continuam abrindo. */

/* ------------------------------------------------------------------ */
/* Some com o que o WordPress publica por conta própria                */
/* ------------------------------------------------------------------ */

/* sitemap do WP anunciando endereços que não queremos indexados */
add_filter('wp_sitemaps_enabled', '__return_false');

/* RSS: ninguém assina o feed do painel */
foreach (['do_feed', 'do_feed_rdf', 'do_feed_rss', 'do_feed_rss2', 'do_feed_atom'] as $gancho) {
    add_action($gancho, function () {
        wp_redirect(WC_SITE_PUBLICO . '/blog/', 302);
        exit;
    }, 1);
}

/* cabeçalhos que expõem versão e rotas do WordPress */
remove_action('wp_head', 'wp_generator');
remove_action('wp_head', 'wlwmanifest_link');
remove_action('wp_head', 'rsd_link');

/* XML-RPC é porta de entrada clássica de ataque e não usamos */
add_filter('xmlrpc_enabled', '__return_false');

/* ------------------------------------------------------------------ */
/* A API continua aberta só no que o site precisa                      */
/* ------------------------------------------------------------------ */

/**
 * /wp-json/wp/v2/users lista todos os usuários do painel para qualquer um —
 * é assim que se descobre login para tentar força bruta.
 *
 * Bloqueia só a listagem. A rota de um usuário específico continua de pé
 * porque é ela que o `_embed` usa para entregar o nome do autor junto do
 * post; sem ela, todo post do site sairia com o autor padrão, em silêncio.
 */
add_filter('rest_endpoints', function ($rotas) {
    if (!is_user_logged_in()) {
        unset($rotas['/wp/v2/users']);
    }
    return $rotas;
});

/* O arquivo por autor também expõe login, mas já cai no redirecionamento
   da frente do site: is_author() é um is_archive(). */
