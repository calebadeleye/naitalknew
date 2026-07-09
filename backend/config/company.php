<?php

return [
    'name' => env('COMPANY_NAME', 'NAI TALK SERVICES'),
    'address_lines' => [
        env('COMPANY_ADDRESS_LINE_1', '7, Unity Rd,'),
        env('COMPANY_ADDRESS_LINE_2', 'Ikola, Lagos.'),
    ],
    'phone' => env('COMPANY_PHONE', '07087057654'),
    'email' => env('COMPANY_EMAIL', 'info@naitalk.com'),
    'website' => env('COMPANY_WEBSITE', 'www.naitalk.com'),
    'rc_number' => env('COMPANY_RC_NUMBER'),
    'tin' => env('COMPANY_TIN'),
];
