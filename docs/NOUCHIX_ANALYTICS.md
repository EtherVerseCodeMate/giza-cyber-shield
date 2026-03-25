# NouchiX Google Analytics Configuration

## Overview
This document contains the configuration details for Google Analytics 4 (GA4) integration for the NouchiX streaming platform.

## Configuration Details

| Property | Value |
| :--- | :--- |
| **Property Name** | NouchiX |
| **Stream URL** | [https://nouchix.com](https://nouchix.com) |
| **Stream ID** | `13585951688` |
| **Measurement ID** | `G-0R9HRJH65R` |

## Implementation
To enable tracking, ensure the GA4 tag is initialized in the application entry point (e.g., `index.html` or `App.tsx`) using the **Measurement ID**.

### Script Snippet
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-0R9HRJH65R"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-0R9HRJH65R');
</script>
```
