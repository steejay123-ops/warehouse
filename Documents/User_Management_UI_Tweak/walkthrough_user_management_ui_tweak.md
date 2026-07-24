# Walkthrough: User Management UI Tweak

## Overview
This walkthrough summarizes the UI adjustments made to the User Management component.

## Changes Made
- **Navigation (Sidebar):** Updated `layout.ts` to change the menu label for `users` from "کاربران و گیت‌پاس" to "کاربران و نقش ها".
- **Users Component:** 
  - Injected `ConfirmDialogService` into `Users` component.
  - Refactored `resetPassword` to use the `ConfirmDialogService` modal rather than the native Windows `confirm()` prompt. This provides a consistent and styled UX for admin actions.

## Validation
- Changes verified in `layout.ts` and `users.ts`. Compilation should succeed and angular dev server will auto-reload with the new UI.
