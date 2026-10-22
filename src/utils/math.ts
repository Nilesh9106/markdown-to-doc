import { mml2omml } from "mathml2omml";
import temml from "temml";

/**
 * Converts LaTeX into OMML, Word's native equation markup.
 * Returns `null` when the LaTeX cannot be parsed.
 */
export function latexToOmml(latex: string, display: boolean): string | null {
  try {
    const mathml = temml.renderToString(latex, {
      xml: true,
      displayMode: display,
      throwOnError: true,
    });
    const omml = mml2omml(mathml);

    return display ? `<m:oMathPara>${omml}</m:oMathPara>` : omml;
  } catch {
    return null;
  }
}
