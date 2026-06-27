/**
 * @soteria/ui — shared, framework-agnostic design system.
 *
 * The package main entry is intentionally React-Native-safe: it exports only
 * pure data (tokens) and helpers. The web-only Tailwind preset lives on the
 * separate `@soteria/ui/tailwind` subpath so it never enters mobile bundles.
 */

export * from './tokens/index';
export * from './tokens/findingColors';
