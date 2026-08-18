<?php
/**
 * Reconstrói o site no Cloudflare Pages quando o conteúdo do blog muda.
 *
 * Fica em wp-content/mu-plugins/: ativa sozinho, não aparece na lista de
 * plugins e ninguém desativa sem querer.
 */

if (!defined('ABSPATH')) {
    exit;
}

/* define() em vez de const: const só aceita valor literal, e uma chamada de
   função ali derruba o WordPress inteiro com erro de parse. */
define('WC_DEPLOY_HOOK_URL', getenv('WC_DEPLOY_HOOK_URL') ?: '');

/* sem URL configurada o plugin fica inerte, em vez de disparar POST a vazio */
if (!WC_DEPLOY_HOOK_URL) {
    return;
}

function wc_disparar_build()
{
    /* Publicar em lote ou salvar duas vezes seguidas não pode virar dois
       builds: o agendamento junta tudo no fim da requisição. */
    static $ja_agendado = false;
    if ($ja_agendado) {
        return;
    }
    $ja_agendado = true;

    add_action('shutdown', function () {
        wp_remote_post(WC_DEPLOY_HOOK_URL, [
            'blocking' => false,
            'timeout'  => 5,
        ]);
    });
}

/* post publicado, post publicado que foi editado, e post tirado do ar
   (nesse caso o site precisa reconstruir para removê-lo) */
add_action('transition_post_status', function ($new_status, $old_status, $post) {
    if ($post->post_type !== 'post') {
        return;
    }
    if ($new_status !== 'publish' && $old_status !== 'publish') {
        return;
    }
    wc_disparar_build();
}, 10, 3);

/* post publicado que vai para a lixeira ou é excluído de vez */
add_action('trashed_post', function ($post_id) {
    if (get_post_type($post_id) === 'post') {
        wc_disparar_build();
    }
});
