<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep anti-stuck recovery in the pinball physics core and regression-test lane waiting and flipper catches, so visual changes cannot alter ball safety.
- Define HUD lighting with semantic CSS tokens and Tailwind utilities, honoring reduced-motion preferences.
- Keep vintage playfield artwork independent from collision geometry; cosmetic rails must not imply additional playable ramps.
- Build Android debug APKs in GitHub Actions by generating Capacitor's Android project and wrapping the configured hosted URL; do not bundle the SSR application as offline Android content.
