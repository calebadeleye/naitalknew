<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceStatus extends Model
{
    protected $fillable = ['service_name', 'status', 'message', 'sort_order'];

    public function isHealthy(): bool
    {
        return $this->status === 'operational';
    }
}
