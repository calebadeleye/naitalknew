<x-mail::layout>
    {{-- Header --}}
    <x-slot:header>
        <x-mail::header :url="config('app.url')">
            {{ config('app.name') }}
        </x-mail::header>
    </x-slot:header>

    {{-- Body --}}
    {{ $slot }}

    Need help? Our support team is ready to assist you.
    Contact Support: info@naitalk.com

    {{-- Subcopy --}}
    @isset($subcopy)
        <x-slot:subcopy>
            <x-mail::subcopy>
                {{ $subcopy }}
            </x-mail::subcopy>
        </x-slot:subcopy>
    @endisset

    {{-- Footer --}}
    <x-slot:footer>
        <x-mail::footer>
            Let's talk | we build | you grow.

            Reliable hosting, powerful solutions, and expert support to help your business grow online.

            info@naitalk.com
            07087057654
            www.naitalk.com
            7 Unity Rd, Off Command Rd, Ikola, Lagos

            © {{ date('Y') }} NAI TALK. @lang('All rights reserved.')
            This is an automated message, please do not reply.
        </x-mail::footer>
    </x-slot:footer>
</x-mail::layout>
