<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Harden workspace_subscription_histories table
        Schema::table('workspace_subscription_histories', function (Blueprint $table) {
            $table->string('workspace_name', 255)->nullable()->after('workspace_id');
            $table->string('plan_name', 100)->nullable()->after('plan_id');
            $table->string('plan_slug', 64)->nullable()->after('plan_name');
            $table->decimal('plan_price', 10, 2)->nullable()->after('plan_slug');
            $table->string('plan_currency', 3)->nullable()->after('plan_price');
            $table->string('previous_plan_name', 100)->nullable()->after('previous_plan_id');

            // Drop cascading foreign keys to prevent silent financial history erasure
            $table->dropForeign(['workspace_id']);
            $table->dropForeign(['subscription_id']);
            $table->dropForeign(['plan_id']);
        });

        Schema::table('workspace_subscription_histories', function (Blueprint $table) {
            // Re-apply restrictive and preserving foreign keys
            $table->foreign('workspace_id')->references('id')->on('workspaces')->restrictOnDelete();

            $table->unsignedBigInteger('subscription_id')->nullable()->change();
            $table->foreign('subscription_id')->references('id')->on('workspace_subscriptions')->nullOnDelete();

            $table->unsignedBigInteger('plan_id')->nullable()->change();
            $table->foreign('plan_id')->references('id')->on('plans')->nullOnDelete();
        });

        // 2. Harden payment_transactions table
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->string('workspace_name', 255)->nullable()->after('workspace_id');
            $table->string('plan_name', 100)->nullable()->after('plan_id');
            $table->string('user_email', 255)->nullable()->after('user_id');

            // Prevent workspace deletion from silently cascading into payment transactions
            $table->dropForeign(['workspace_id']);
        });

        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->foreign('workspace_id')->references('id')->on('workspaces')->restrictOnDelete();
        });

        // Backfill existing history records with snapshots where available
        $histories = DB::table('workspace_subscription_histories')->get();
        foreach ($histories as $history) {
            $ws = DB::table('workspaces')->where('id', $history->workspace_id)->first();
            $plan = $history->plan_id ? DB::table('plans')->where('id', $history->plan_id)->first() : null;
            $prevPlan = $history->previous_plan_id ? DB::table('plans')->where('id', $history->previous_plan_id)->first() : null;

            DB::table('workspace_subscription_histories')->where('id', $history->id)->update([
                'workspace_name' => $ws?->name,
                'plan_name' => $plan?->name,
                'plan_slug' => $plan?->slug,
                'plan_price' => $plan?->price,
                'plan_currency' => $plan?->currency,
                'previous_plan_name' => $prevPlan?->name,
            ]);
        }

        $payments = DB::table('payment_transactions')->get();
        foreach ($payments as $payment) {
            $ws = DB::table('workspaces')->where('id', $payment->workspace_id)->first();
            $plan = $payment->plan_id ? DB::table('plans')->where('id', $payment->plan_id)->first() : null;
            $user = $payment->user_id ? DB::table('users')->where('id', $payment->user_id)->first() : null;

            DB::table('payment_transactions')->where('id', $payment->id)->update([
                'workspace_name' => $ws?->name,
                'plan_name' => $plan?->name,
                'user_email' => $user?->email,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->dropForeign(['workspace_id']);
            $table->dropColumn(['workspace_name', 'plan_name', 'user_email']);
        });

        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
        });

        Schema::table('workspace_subscription_histories', function (Blueprint $table) {
            $table->dropForeign(['workspace_id']);
            $table->dropForeign(['subscription_id']);
            $table->dropForeign(['plan_id']);

            $table->dropColumn([
                'workspace_name',
                'plan_name',
                'plan_slug',
                'plan_price',
                'plan_currency',
                'previous_plan_name',
            ]);
        });

        Schema::table('workspace_subscription_histories', function (Blueprint $table) {
            $table->foreign('workspace_id')->references('id')->on('workspaces')->cascadeOnDelete();
            $table->unsignedBigInteger('subscription_id')->nullable(false)->change();
            $table->foreign('subscription_id')->references('id')->on('workspace_subscriptions')->cascadeOnDelete();
            $table->unsignedBigInteger('plan_id')->nullable(false)->change();
            $table->foreign('plan_id')->references('id')->on('plans')->restrictOnDelete();
        });
    }
};
