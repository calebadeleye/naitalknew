<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebsiteQuoteReferenceSequence extends Model
{
    protected $fillable = [
        'date',
        'last_number',
    ];
}
