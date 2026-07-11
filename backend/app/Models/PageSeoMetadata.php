<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PageSeoMetadata extends Model
{
    protected $table = 'page_seo_metadata';

    protected $fillable = ['path', 'seo_title', 'meta_description', 'og_image', 'canonical_url'];
}
