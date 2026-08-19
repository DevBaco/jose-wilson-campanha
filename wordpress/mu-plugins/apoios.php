<?php
/**
 * Recebe o formulário de apoio do site e guarda no painel do WordPress.
 *
 * Fica em wp-content/mu-plugins/: ativa sozinho e não some se alguém mexer
 * na lista de plugins.
 *
 * Configuração opcional no wp-config.php:
 *   define('WC_TURNSTILE_SECRET', 'chave-secreta-do-turnstile');
 * Sem ela, o Turnstile é ignorado e sobram o honeypot e o limite por IP.
 */

if (!defined('ABSPATH')) {
    exit;
}

const WC_APOIO_CPT     = 'wc_apoio';
const WC_APOIO_ORIGEM  = 'https://wilsoncamposoficial.com.br';
const WC_APOIO_LIMITE  = 5;    // envios por IP
const WC_APOIO_JANELA  = 3600; // ...por hora

/* ------------------------------------------------------------------ */
/* Tipo de conteúdo                                                    */
/* ------------------------------------------------------------------ */

add_action('init', function () {
    register_post_type(WC_APOIO_CPT, [
        'labels' => [
            'name'          => 'Apoios',
            'singular_name' => 'Apoio',
            'menu_name'     => 'Apoios',
            'all_items'     => 'Todos os apoios',
            'search_items'  => 'Buscar apoios',
            'not_found'     => 'Nenhum apoio recebido ainda.',
        ],
        'public'              => false,   // não vira página no site
        'publicly_queryable'  => false,
        'exclude_from_search' => true,
        'show_ui'             => true,
        'show_in_rest'        => false,   // não expõe os dados na API pública
        'menu_icon'           => 'dashicons-groups',
        'menu_position'       => 25,
        'capability_type'     => 'post',  // Editor e Administrador enxergam
        'supports'            => ['title'],
    ]);
});

/* Ninguém cria apoio na mão: eles só chegam pelo formulário. */
add_filter('post_row_actions', function ($acoes, $post) {
    if ($post->post_type === WC_APOIO_CPT) {
        unset($acoes['inline hide-if-no-js']);
    }
    return $acoes;
}, 10, 2);

/* ------------------------------------------------------------------ */
/* Endpoint que o site chama                                           */
/* ------------------------------------------------------------------ */

function wc_apoio_cors()
{
    $origem = isset($_SERVER['HTTP_ORIGIN']) ? esc_url_raw(wp_unslash($_SERVER['HTTP_ORIGIN'])) : '';
    if ($origem === WC_APOIO_ORIGEM) {
        header('Access-Control-Allow-Origin: ' . WC_APOIO_ORIGEM);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

function wc_apoio_ip()
{
    /* atrás da Cloudflare, REMOTE_ADDR é o proxy: o IP real vem no header */
    foreach (['HTTP_CF_CONNECTING_IP', 'REMOTE_ADDR'] as $chave) {
        if (!empty($_SERVER[$chave])) {
            return sanitize_text_field(wp_unslash($_SERVER[$chave]));
        }
    }
    return 'desconhecido';
}

function wc_apoio_turnstile_ok($token)
{
    if (!defined('WC_TURNSTILE_SECRET') || !WC_TURNSTILE_SECRET) {
        return true; // não configurado: honeypot e limite por IP seguram
    }
    if (!$token) {
        return false;
    }

    $resposta = wp_remote_post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
        'timeout' => 8,
        'body'    => [
            'secret'   => WC_TURNSTILE_SECRET,
            'response' => $token,
            'remoteip' => wc_apoio_ip(),
        ],
    ]);

    if (is_wp_error($resposta)) {
        /* Cloudflare fora do ar não pode derrubar o formulário da campanha:
           as outras camadas continuam valendo */
        return true;
    }

    $dados = json_decode(wp_remote_retrieve_body($resposta), true);
    return !empty($dados['success']);
}

add_action('rest_api_init', function () {
    register_rest_route('wilson/v1', '/apoio', [
        [
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => 'wc_apoio_receber',
        ],
        [
            'methods'             => 'OPTIONS',
            'permission_callback' => '__return_true',
            'callback'            => function () {
                wc_apoio_cors();
                return new WP_REST_Response(null, 204);
            },
        ],
    ]);
});

function wc_apoio_receber(WP_REST_Request $req)
{
    wc_apoio_cors();

    /* O robô preenche todos os campos que encontra, inclusive o escondido.
       Responder "ok" faz ele ir embora satisfeito sem tentar de novo. */
    if (trim((string) $req->get_param('apelido')) !== '') {
        return new WP_REST_Response(['ok' => true], 200);
    }

    $ip    = wc_apoio_ip();
    $chave = 'wc_apoio_' . md5($ip);
    $conta = (int) get_transient($chave);
    if ($conta >= WC_APOIO_LIMITE) {
        return new WP_REST_Response(
            ['ok' => false, 'erro' => 'Muitos envios seguidos. Tente novamente mais tarde.'],
            429
        );
    }

    if (!wc_apoio_turnstile_ok($req->get_param('turnstile'))) {
        return new WP_REST_Response(
            ['ok' => false, 'erro' => 'Não foi possível confirmar que você não é um robô. Recarregue a página.'],
            403
        );
    }

    $nome  = sanitize_text_field((string) $req->get_param('nome'));
    $email = sanitize_email((string) $req->get_param('email'));

    if ($nome === '' || !is_email($email)) {
        return new WP_REST_Response(
            ['ok' => false, 'erro' => 'Informe nome e um e-mail válido.'],
            400
        );
    }
    if (!$req->get_param('consentimento_lgpd')) {
        return new WP_REST_Response(
            ['ok' => false, 'erro' => 'É preciso concordar com o uso dos dados.'],
            400
        );
    }

    $campos = [
        'email'      => $email,
        'telefone'   => sanitize_text_field((string) $req->get_param('telefone')),
        'cidade'     => sanitize_text_field((string) $req->get_param('cidade')),
        'profissao'  => sanitize_text_field((string) $req->get_param('profissao')),
        /* o campo se chama "contribuicao" no formulário do site; "mensagem"
           fica como alternativa para não quebrar se o nome mudar lá */
        'mensagem'   => sanitize_textarea_field(
            (string) ($req->get_param('contribuicao') ?: $req->get_param('mensagem'))
        ),
        'ip'         => $ip,
        'consentido' => current_time('mysql'),
    ];

    $id = wp_insert_post([
        'post_type'   => WC_APOIO_CPT,
        'post_title'  => $nome,
        'post_status' => 'publish',
        'meta_input'  => array_merge($campos, ['lido' => 0]),
    ], true);

    if (is_wp_error($id)) {
        return new WP_REST_Response(['ok' => false, 'erro' => 'Erro ao registrar. Tente novamente.'], 500);
    }

    set_transient($chave, $conta + 1, WC_APOIO_JANELA);

    return new WP_REST_Response(['ok' => true], 201);
}

/* ------------------------------------------------------------------ */
/* Painel: a lista precisa se anunciar, já que ninguém olha e-mail     */
/* ------------------------------------------------------------------ */

function wc_apoios_nao_lidos()
{
    $q = new WP_Query([
        'post_type'      => WC_APOIO_CPT,
        'post_status'    => 'publish',
        'posts_per_page' => 1,
        'fields'         => 'ids',
        'meta_query'     => [['key' => 'lido', 'value' => '0']],
        'no_found_rows'  => false,
    ]);
    return (int) $q->found_posts;
}

/* bolinha com o número de apoios novos, do lado do menu */
add_action('admin_menu', function () {
    global $menu;
    $novos = wc_apoios_nao_lidos();
    if (!$novos) {
        return;
    }
    foreach ($menu as $i => $item) {
        if (isset($item[2]) && $item[2] === 'edit.php?post_type=' . WC_APOIO_CPT) {
            $menu[$i][0] .= sprintf(
                ' <span class="update-plugins count-%1$d"><span class="plugin-count">%1$d</span></span>',
                $novos
            );
            break;
        }
    }
}, 999);

/* colunas úteis na listagem */
add_filter('manage_' . WC_APOIO_CPT . '_posts_columns', function () {
    return [
        'cb'       => '<input type="checkbox" />',
        'title'    => 'Nome',
        'contato'  => 'Contato',
        'cidade'   => 'Cidade',
        'mensagem' => 'Como quer participar',
        'data'     => 'Recebido em',
    ];
});

add_action('manage_' . WC_APOIO_CPT . '_posts_custom_column', function ($coluna, $id) {
    switch ($coluna) {
        case 'contato':
            $email = get_post_meta($id, 'email', true);
            $tel   = get_post_meta($id, 'telefone', true);
            echo esc_html($email);
            if ($tel) {
                echo '<br><small>' . esc_html($tel) . '</small>';
            }
            break;
        case 'cidade':
            echo esc_html(get_post_meta($id, 'cidade', true) ?: '—');
            break;
        case 'mensagem':
            echo esc_html(wp_trim_words((string) get_post_meta($id, 'mensagem', true), 14, '…') ?: '—');
            break;
        case 'data':
            echo esc_html(get_the_date('d/m/Y H:i', $id));
            break;
    }
}, 10, 2);

/* abrir o apoio marca como lido */
add_action('load-post.php', function () {
    $id = isset($_GET['post']) ? (int) $_GET['post'] : 0;
    if ($id && get_post_type($id) === WC_APOIO_CPT) {
        update_post_meta($id, 'lido', 1);
    }
});

/* os dados no editor, já que o CPT só tem título */
add_action('add_meta_boxes', function () {
    add_meta_box('wc_apoio_dados', 'Dados enviados', function ($post) {
        $campos = [
            'email'      => 'E-mail',
            'telefone'   => 'Telefone',
            'cidade'     => 'Cidade',
            'profissao'  => 'Profissão',
            'mensagem'   => 'Como quer participar',
            'consentido' => 'Consentimento LGPD em',
            'ip'         => 'IP de origem',
        ];
        echo '<table class="widefat striped">';
        foreach ($campos as $chave => $rotulo) {
            printf(
                '<tr><th style="width:220px">%s</th><td>%s</td></tr>',
                esc_html($rotulo),
                nl2br(esc_html((string) get_post_meta($post->ID, $chave, true) ?: '—'))
            );
        }
        echo '</table>';
    }, WC_APOIO_CPT, 'normal', 'high');
});

/* ------------------------------------------------------------------ */
/* Exportar CSV                                                        */
/* ------------------------------------------------------------------ */

add_action('admin_menu', function () {
    add_submenu_page(
        'edit.php?post_type=' . WC_APOIO_CPT,
        'Exportar apoios',
        'Exportar CSV',
        'edit_posts',
        'wc-apoios-csv',
        function () {
            $url = wp_nonce_url(
                admin_url('edit.php?post_type=' . WC_APOIO_CPT . '&wc_apoios_csv=1'),
                'wc_apoios_csv'
            );
            echo '<div class="wrap"><h1>Exportar apoios</h1>';
            echo '<p>Baixe todos os apoios recebidos em uma planilha.</p>';
            echo '<p><a class="button button-primary" href="' . esc_url($url) . '">Baixar CSV</a></p></div>';
        }
    );
});

add_action('admin_init', function () {
    if (empty($_GET['wc_apoios_csv']) || !current_user_can('edit_posts')) {
        return;
    }
    check_admin_referer('wc_apoios_csv');

    $apoios = get_posts([
        'post_type'      => WC_APOIO_CPT,
        'posts_per_page' => -1,
        'orderby'        => 'date',
        'order'          => 'DESC',
    ]);

    nocache_headers();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=apoios-' . date('Y-m-d') . '.csv');

    $saida = fopen('php://output', 'w');
    fwrite($saida, "\xEF\xBB\xBF"); // BOM: o Excel abre acentuação certa
    fputcsv($saida, ['Nome', 'E-mail', 'Telefone', 'Cidade', 'Profissão', 'Mensagem', 'Recebido em']);
    foreach ($apoios as $apoio) {
        fputcsv($saida, [
            $apoio->post_title,
            get_post_meta($apoio->ID, 'email', true),
            get_post_meta($apoio->ID, 'telefone', true),
            get_post_meta($apoio->ID, 'cidade', true),
            get_post_meta($apoio->ID, 'profissao', true),
            get_post_meta($apoio->ID, 'mensagem', true),
            get_the_date('d/m/Y H:i', $apoio),
        ]);
    }
    fclose($saida);
    exit;
});
