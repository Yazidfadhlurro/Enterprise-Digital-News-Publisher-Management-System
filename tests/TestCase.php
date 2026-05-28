<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function migrateDatabases()
    {
        $this->artisan('migrate:fresh', array_merge(
            $this->migrateFreshUsing(),
            ['--force' => true]
        ));
    }
}
