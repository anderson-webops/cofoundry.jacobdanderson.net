<script setup lang="ts">
usePageSeo("Privacy Policy")
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Legal"
      title="Privacy Policy"
      description="This policy explains the MVP data model and privacy posture. A production launch should include legal review, retention policy decisions, and a final data processing inventory."
    />

    <div class="panel text-sm leading-7 mt-10 p-6 gap-8 grid md:p-8">
      <section>
        <h2 class="text-lg font-semibold">
          1. What we collect
        </h2>
        <p class="muted mt-3">
          Account details, profile information, opportunity postings, messages, proposals, contracts, billing metadata, moderation actions, and settings preferences.
        </p>
      </section>
      <section>
        <h2 class="text-lg font-semibold">
          2. How we use it
        </h2>
        <p class="muted mt-3">
          To operate discovery, matching, messaging, proposals, contracts, billing, trust and safety, and product analytics. Direct contact details remain hidden until a mutual match unlocks messaging.
        </p>
      </section>
      <section>
        <h2 class="text-lg font-semibold">
          3. Data controls
        </h2>
        <p class="muted mt-3">
          Users can control profile visibility, portfolio visibility, and contact exposure. Admin access should be limited to moderation and operational support functions.
        </p>
      </section>
      <section>
        <h2 class="text-lg font-semibold">
          4. Storage and processors
        </h2>
        <p class="muted mt-3">
          This MVP is designed around Supabase for auth, database, realtime messaging, and storage, with Stripe used for billing when configured. Local development can run entirely in mock mode without external keys.
        </p>
      </section>
    </div>
  </div>
</template>
