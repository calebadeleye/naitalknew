<?php

namespace App\Services\Domains;

use App\Models\Client;
use App\Models\DomainContact;
use RuntimeException;

/**
 * Domain registration/transfer requires registrant/admin/tech/billing
 * contact details. NAI TALK keeps one contact profile per client
 * (domain_contacts) and reuses it uniformly across all four Spaceship
 * contact roles.
 */
class SpaceshipDomainContactService
{
    public function __construct(private readonly SpaceshipClient $client)
    {
    }

    /**
     * @throws RuntimeException if the client hasn't completed their domain contact profile.
     */
    public function contactFor(Client $client): DomainContact
    {
        $contact = DomainContact::query()->where('client_id', $client->id)->first();

        if (! $contact || ! $contact->isComplete()) {
            throw new RuntimeException('Please complete your domain contact profile before purchasing or transferring a domain.');
        }

        return $contact;
    }

    /**
     * Creates the contact on Spaceship the first time it's needed and
     * remembers the provider's contact ID so it's never recreated.
     */
    public function providerContactId(DomainContact $contact): string
    {
        if ($contact->provider_contact_id) {
            return $contact->provider_contact_id;
        }

        $providerContactId = $this->client->createContact([
            'firstName' => $contact->full_name,
            'organization' => $contact->company_name,
            'email' => $contact->email,
            'phone' => $contact->phone,
            'address' => $contact->address,
            'city' => $contact->city,
            'state' => $contact->state,
            'country' => $contact->country,
            'postalCode' => $contact->postal_code,
        ]);

        $contact->forceFill(['provider_contact_id' => $providerContactId])->save();

        return $providerContactId;
    }

    /**
     * @return array{registrant: string, admin: string, tech: string, billing: string}
     */
    public function contactSetFor(DomainContact $contact): array
    {
        $id = $this->providerContactId($contact);

        return ['registrant' => $id, 'admin' => $id, 'tech' => $id, 'billing' => $id];
    }
}
