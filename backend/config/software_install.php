<?php

return [
    // The dedicated, non-client-facing build account described in the
    // "Software" install feature's plan — resource-capped via a systemd
    // slice on the hosting server so a build can never starve other
    // tenants. This is a deployment credential, set up once, the same way
    // ISPCONFIG_REMOTE_USER/PASSWORD are.
    'ssh_host' => env('SOFTWARE_INSTALL_SSH_HOST'),
    'ssh_port' => (int) env('SOFTWARE_INSTALL_SSH_PORT', 22),
    'ssh_user' => env('SOFTWARE_INSTALL_SSH_USER'),
    'ssh_private_key_path' => env('SOFTWARE_INSTALL_SSH_KEY_PATH'),

    // Where clones/builds happen before their output is copied into a
    // client's own hosting space.
    'build_root' => env('SOFTWARE_INSTALL_BUILD_ROOT', '/home/naitalk-software-builder/builds'),

    // The shared Redis instance every install is isolated within (see the
    // Redis isolation note in the install plan — one DB-index triple per
    // install, ~5 installs before this needs revisiting).
    'redis_host' => env('SOFTWARE_INSTALL_REDIS_HOST', '127.0.0.1'),
    'redis_port' => (int) env('SOFTWARE_INSTALL_REDIS_PORT', 6379),
    'redis_password' => env('SOFTWARE_INSTALL_REDIS_PASSWORD'),
    'redis_max_db_index' => (int) env('SOFTWARE_INSTALL_REDIS_MAX_DB_INDEX', 15),

    // Node process port range PM2-managed frontend apps get assigned from.
    'node_port_range_start' => (int) env('SOFTWARE_INSTALL_NODE_PORT_START', 4100),
    'node_port_range_end' => (int) env('SOFTWARE_INSTALL_NODE_PORT_END', 4999),
];
