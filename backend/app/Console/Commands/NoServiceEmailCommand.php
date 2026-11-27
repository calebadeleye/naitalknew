<?php

namespace App\Console\Commands;

use App\Models\Client;
use App\Models\Domain;
use App\Models\HostingService;
use App\Models\Payment;
use App\Notifications\NoServiceFollowUp;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Sends the "you haven't set up a service yet" check-in to the clients named by
 * id. Nothing goes out without --test (one copy to an address of your choice,
 * built for the first client) or --send. A client who has since paid, or now
 * has a service or domain, is skipped.
 */
class NoServiceEmailCommand extends Command
{
    protected $signature = 'clients:no-service-email
        {clients* : Client ids}
        {--test= : Send one test copy to this address instead}
        {--send : Really send to the clients}';

    protected $description = 'Send the one-off "let\'s get you online" email to clients who signed up but have no paid service.';

    public function handle(): int
    {
        $clients = Client::query()->with('user')->whereIn('id', $this->argument('clients'))->get();

        if ($clients->isEmpty()) {
            $this->error('No matching clients.');

            return self::FAILURE;
        }

        if ($test = $this->option('test')) {
            Notification::route('mail', $test)->notifyNow(new NoServiceFollowUp($clients->first()));
            $this->info("Test copy (as for client {$clients->first()->id}) sent to {$test}.");

            return self::SUCCESS;
        }

        if (! $this->option('send')) {
            $this->warn('Nothing sent. Use --test=address for a test copy or --send to send for real.');

            return self::SUCCESS;
        }

        foreach ($clients as $client) {
            $hasSomething = Payment::where('client_id', $client->id)->where('status', 'paid')->exists()
                || HostingService::where('client_id', $client->id)->exists()
                || Domain::where('client_id', $client->id)->exists();

            if ($hasSomething || ! $client->user?->email) {
                $this->line("Skipped client {$client->id}: now has a service, domain or payment, or no email.");

                continue;
            }

            $client->user->notifyNow(new NoServiceFollowUp($client));
            $this->info("Sent to client {$client->id}.");
        }

        return self::SUCCESS;
    }
}
