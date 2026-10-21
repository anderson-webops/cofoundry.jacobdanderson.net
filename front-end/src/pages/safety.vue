<script setup lang="ts">
import { trustPillars } from "~/shared/data/marketing"

usePageSeo("Trust & Safety", "Designed to reduce spam, ambiguity, and bad-faith founder behavior.", {
  canonicalPath: "/safety",
})
</script>

<template>
  <div class="reading-shell page-section">
    <PageIntro
      eyebrow="Trust & Safety"
      title="Trust and safety controls."
    />

    <div class="process-list mt-10">
      <article v-for="pillar in trustPillars" :key="pillar.title" class="process-list-item">
        <h2 class="text-lg font-semibold">
          {{ pillar.title }}
        </h2>
        <p class="muted text-sm leading-7">
          {{ pillar.body }}
        </p>
      </article>
    </div>

    <section class="mt-12">
      <h2 class="text-2xl font-semibold">
        Trust tiers
      </h2>
      <div class="process-list mt-6">
        <article class="process-list-item">
          <p class="text-sm font-semibold">
            Level A
          </p>
          <p class="muted text-sm leading-6">
            Verified email plus a baseline profile. Good for browsing and getting set up, but not enough for outbound outreach.
          </p>
        </article>
        <article class="process-list-item">
          <p class="text-sm font-semibold">
            Level B
          </p>
          <p class="muted text-sm leading-6">
            Phone verification plus a completed profile. This is the baseline required before cold message requests leave your account.
          </p>
        </article>
        <article class="process-list-item">
          <p class="text-sm font-semibold">
            Level C
          </p>
          <p class="muted text-sm leading-6">
            Higher-assurance identity checks for higher-risk actions like contract signing or sensitive-role claims.
          </p>
        </article>
      </div>
    </section>

    <section class="mt-12">
      <h2 class="text-2xl font-semibold">
        Enforcement
      </h2>
      <ul class="text-sm leading-7 mt-6 gap-4 grid">
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>Flag profiles, messages, and opportunities from inside the product.</span>
        </li>
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>Admin moderation queue with suspension tools and action history.</span>
        </li>
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>Profile completion, proof-of-work, and verification badges to help users assess trust signals quickly.</span>
        </li>
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>Responsiveness and recent-activity signals make inactive accounts easier to identify.</span>
        </li>
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>Short trial collaboration plans before final founder terms, so commitment and decision-rights mismatches show up earlier and at lower cost.</span>
        </li>
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>Opportunity listings carry visible ownership proof states such as verified owner or domain verified, instead of making every listing look equally trustworthy.</span>
        </li>
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>High-priority reports like impersonation, scam language, and privacy violations are escalated separately from normal moderation noise.</span>
        </li>
      </ul>
    </section>

    <section class="mt-12">
      <h2 class="text-2xl font-semibold">
        Behavior that degrades the network
      </h2>
      <div class="process-list mt-6">
        <article class="process-list-item">
          <p class="text-sm font-semibold">
            Not acceptable
          </p>
          <ul class="muted text-sm leading-6 mt-3 gap-2 grid">
            <li>Using CoFoundry as a freelance lead-gen or recruiting channel.</li>
            <li>Misrepresenting traction, role, availability, or intent.</li>
            <li>Harvesting contact details or pushing people off-platform before consent.</li>
            <li>Repeatedly matching and then disappearing without response.</li>
          </ul>
        </article>
        <article class="process-list-item">
          <p class="text-sm font-semibold">
            Expected behavior
          </p>
          <ul class="muted text-sm leading-6 mt-3 gap-2 grid">
            <li>Keep profiles current enough that discovery stays trustworthy.</li>
            <li>Be explicit about company shape, commitment, and non-negotiables.</li>
            <li>Use first-call agendas, trial sprints, and proposal comments to surface disagreement early.</li>
            <li>Review any generated agreements with qualified legal counsel before execution.</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="mt-12">
      <h2 class="text-2xl font-semibold">
        Official communication rules
      </h2>
      <div class="process-list mt-6">
        <article class="process-list-item">
          <p class="text-sm font-semibold">
            What CoFoundry will do
          </p>
          <ul class="muted text-sm leading-6 mt-3 gap-2 grid">
            <li>Show trust signals without exposing private email or phone numbers publicly.</li>
            <li>Warn when conversations contain common off-platform or payment-related scam patterns.</li>
            <li>Keep direct contact gated by mutual consent and each member's chosen reveal stage.</li>
          </ul>
        </article>
        <article class="process-list-item">
          <p class="text-sm font-semibold">
            What CoFoundry will not do
          </p>
          <ul class="muted text-sm leading-6 mt-3 gap-2 grid">
            <li>Ask for diligence fees, wire transfers, or crypto payments in chat.</li>
            <li>Tell you to move a conversation to WhatsApp or Telegram before trust is established.</li>
            <li>Represent an investor's intent or ability to fund a company just because an identity signal is present.</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="surface-row mt-12">
      <h2 class="text-2xl font-semibold">
        Appeals and redress
      </h2>
      <p class="muted text-sm leading-7 mt-4">
        Moderation actions and report context are retained for review.
      </p>
    </section>
  </div>
</template>
