---
sidebar_position: 4
title: "Patterns"
description: "How to use kube properly — correct patterns and common mistakes"
---

# Patterns

This section covers correct patterns for using kube, along with mistakes that real users encounter repeatedly. It is organized based on the most frequently asked questions from GitHub Issues and Discussions.

## What This Section Covers

| Document | Key Question |
|----------|-------------|
| [Reconciler Patterns](./reconciler.md) | How do you write an idempotent reconciler and avoid infinite loops? |
| [Relations and Finalizers](./relations-and-finalizers.md) | How do owns/watches work internally, and when should you use finalizers? |
| [Server-Side Apply](./server-side-apply.md) | What is the correct way to use SSA, and what are the common pitfalls? |
| [Third-Party CRDs](./third-party-crds.md) | How do you work with CRDs you didn't create yourself? |
| [Error Handling and Backoff](./error-handling-and-backoff.md) | Where do different errors come from, and how do you configure backoff? |
| [Generic Controllers](./generic-controllers.md) | How do you build reusable reconcilers for multiple resources and run multiple Controllers? |
| [Troubleshooting](./troubleshooting.md) | How do you quickly resolve issues using symptom-based diagnosis, debugging tools, and profiling? |

If you have already understood the internals from the [Runtime Internals](../runtime-internals/index.md) section, this section covers "so how should you actually use it."
