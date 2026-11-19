# FMHY source reconciliation

Run:

```sh
node scripts/reconcile-fmhy-directory.mjs
```

This creates `data/fmhy-source-reconciliation.json`, reconciling the checked-in FMHY directory metadata with the generated runtime source registry.

The report separates website links from common community/social links, compares normalized hosts against canonical domains and aliases in the deployment registry, and lists unmatched domains for later recognition and live extractability testing.

This is an offline inventory only. It does not probe websites, extract media, validate playback, or enable any source. A domain match is not proof of current playback support.
