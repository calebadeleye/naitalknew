<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SiteMetricDaily extends Model
{
    protected $table = 'site_metrics_daily';

    protected $fillable = ['hosting_service_id', 'date', 'visits', 'pages', 'hits', 'bandwidth_bytes'];

    protected function casts(): array
    {
        return ['date' => 'date'];
    }
}
