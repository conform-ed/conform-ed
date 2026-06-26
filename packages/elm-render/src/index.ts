// @conform-ed/elm-render — the EDC Reference Renderer (conform-ed ADR-0019). Framework-light,
// accessible, unstyled semantic-HTML rendering of a European Digital Credential, driven by its
// displayParameter / langStrings. Not a product UI; downstream products consume the view-model
// and wrap it in their own framework.

export { availableLanguages, type LangString, selectText } from "./language";
export {
  type BuildViewModelOptions,
  buildViewModel,
  type EdcClaimView,
  type EdcImageView,
  type EdcViewModel,
} from "./view-model";
export { renderEdc, type RenderResult } from "./render-edc";
