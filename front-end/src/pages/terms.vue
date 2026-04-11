<script setup lang="ts">
usePageSeo("Terms of Service")
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Legal"
      title="Terms of Service"
      description="These terms are presented for MVP completeness and local development. They should be reviewed by counsel before a production launch."
    />

    <div class="panel text-sm leading-7 mt-10 p-6 gap-8 grid md:p-8">
      <section>
        <h2 class="text-lg font-semibold">
          1. Service scope
        </h2>
        <p class="muted mt-3">
          CoFoundry is software for founder matching, messaging, proposals, and contract templating. It is not a broker-dealer, employment agency, law firm, or investment adviser.
        </p>
      </section>
      <section>
        <h2 class="text-lg font-semibold">
          2. User responsibilities
        </h2>
        <p class="muted mt-3">
          You are responsible for the accuracy of your profile, startup opportunity postings, and communications. Misrepresentation, harassment, and off-platform spam may result in suspension.
        </p>
      </section>
      <section>
        <h2 class="text-lg font-semibold">
          3. Contract templates
        </h2>
        <p class="muted mt-3">
          CoFoundry provides editable contract templates for convenience. They are not legal advice and should be reviewed by qualified counsel before execution.
        </p>
      </section>
      <section>
        <h2 class="text-lg font-semibold">
          4. Payments
        </h2>
        <p class="muted mt-3">
          Paid subscriptions unlock workflow features and account visibility benefits. Subscription fees do not give CoFoundry automatic equity or ownership rights in your venture.
        </p>
      </section>
    </div>
  </div>
</template>
