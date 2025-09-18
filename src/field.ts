import { version } from "os";
import { FieldBuilder } from "./field.builder.js";
import { Infer } from "./infer.js";
import { SchemaShape } from "./types.js";
import {
  validateCountryCode,
  validateDateTimeISO,
  validateEmail,
  validatePhone,
  validateRichText,
  validateSafeText,
  validateSemVer,
  validateUrl,
  validateUUID,
} from "./validation/index.js";
import { validateLanguage } from "./validation/languageCode.BCP47.js";

export const field = {
  string: () => new FieldBuilder<string>("string"),
  number: () => new FieldBuilder<number>("number"),
  boolean: () => new FieldBuilder<boolean>("boolean"),
  object: <T extends Record<string, FieldBuilder>>(fields: T) =>
    new FieldBuilder<T>("object", { shape: fields }),
  array: (itemType: FieldBuilder) => new FieldBuilder("array", { itemType }),
  ref: <S extends SchemaShape>(refType: string) =>
    new FieldBuilder<Infer<S>>("ref", { refType }),
  email: () =>
    new FieldBuilder<string>("string")
      .validator(validateEmail)
      .PID({
        classification: "high",
        action: "encrypt",
        logHandling: "redact",
        purpose: "an email address",
      })
      .description("An email address"),
  phone: () =>
    new FieldBuilder<string>("string")
      .validator(validatePhone)
      .PID({
        classification: "high",
        action: "encrypt",
        logHandling: "redact",
        purpose: "a phone number",
      })
      .description("A phone number"),
  url: () =>
    new FieldBuilder<string>("string")
      .validator(validateUrl)
      .PID({
        classification: "low",
        action: "hash",
        logHandling: "pseudonym",
        purpose: "a URL",
      })
      .description("A URL"),
  uuid: () =>
    new FieldBuilder<string>("string")
      .PID({
        classification: "low",
        action: "hash",
        logHandling: "pseudonym",
        purpose: "a UUID",
      })
      .validator(validateUUID)
      .description("A UUID"),
  dateTimeISO: () =>
    new FieldBuilder<string>("string")
      .PID({
        classification: "none",
        action: "none",
        logHandling: "plain",
        purpose: "a date string",
      })
      .validator(validateDateTimeISO)
      .description("A date string in ISO 8601 format"),
  dateISO: () =>
    new FieldBuilder<string>("string")
      .PID({
        classification: "none",
        action: "none",
        logHandling: "plain",
        purpose: "a date string",
      })
      .validator((s) => validateDateTimeISO(s, { mode: "date" }))
      .description("A date string in ISO 8601 format (date only)"),
  timeISO: () =>
    new FieldBuilder<string>("string")
      .PID({
        classification: "none",
        action: "none",
        logHandling: "plain",
        purpose: "a time string",
      })
      .validator((s) => validateDateTimeISO(s, { mode: "time" }))
      .description("A time string in ISO 8601 format (time only)"),
  richText: () =>
    new FieldBuilder<string>("string")
      .PID({
        classification: "low",
        action: "clear",
        logHandling: "omit",
        purpose: "rich text content",
      })
      .validator(validateRichText)
      .description("Rich text content, may include basic HTML formatting"),
  generalText: () =>
    new FieldBuilder<string>("string")
      .PID({
        classification: "none",
        action: "none",
        logHandling: "plain",
        purpose: "Plain text content",
      })
      .validator(validateSafeText)
      .description("Standard text content, no HTML allowed"),
  latitude: () =>
    new FieldBuilder<number>("number")
      .PID({
        classification: "low",
        action: "clear",
        logHandling: "omit",
        purpose: "Latitude in decimal degrees, WGS 84 (ISO 6709)",
      })
      .min(-90)
      .max(90)
      .description("Latitude in decimal degrees, WGS 84 (ISO 6709)"),
  longitude: () =>
    new FieldBuilder<number>("number")
      .PID({
        classification: "low",
        action: "clear",
        logHandling: "omit",
        purpose: "Longitude in decimal degrees, WGS 84 (ISO 6709)",
      })
      .min(-180)
      .max(180)
      .description("Longitude in decimal degrees, WGS 84 (ISO 6709)"),
  version: () =>
    new FieldBuilder<string>("string")
      .validator(validateSemVer)
      .description("A semantic version string, e.g. '1.0.0'"),
  countryCode: () =>
    new FieldBuilder<string>("string")
      .validator(validateCountryCode)
      .description("An ISO 3166 country code, e.g. 'US', 'GB', 'FR'"),
  languageCode: () =>
    new FieldBuilder<string>("string")
      .validator(validateLanguage)
      .description(
        "An BCP 47 structured language code, primarily ISO 639-1 and optionally with ISO 3166-1 alpha-2 country code, e.g. 'en', 'en-US', 'fr', 'fr-FR'"
      ),
};
