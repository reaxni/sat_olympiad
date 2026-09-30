import { Content } from './Content';
import './MathExam.css';

export function NumericDirections() {
  return <section className="numeric-directions" aria-label="Student-produced response directions">
    <h2>Student-produced response directions</h2>
    <ul>
      <li>If you find <strong>more than one correct answer</strong>, enter only one answer.</li>
      <li>You can enter up to 5 characters for a <strong>positive</strong> answer and up to 6 characters (including the negative sign) for a <strong>negative</strong> answer.</li>
      <li>If your answer is a <strong>fraction</strong> that doesn’t fit in the provided space, enter the decimal equivalent.</li>
      <li>If your answer is a <strong>decimal</strong> that doesn’t fit in the provided space, enter it by truncating or rounding at the fourth digit.</li>
      <li>If your answer is a <strong>mixed number</strong> (such as 3½), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).</li>
      <li>Don’t enter <strong>symbols</strong> such as a percent sign, comma, or dollar sign.</li>
    </ul>
    <table><caption>Examples</caption><thead><tr><th scope="col">Answer</th><th scope="col">Acceptable ways to enter answer</th><th scope="col">Unacceptable: will NOT receive credit</th></tr></thead><tbody>
      <tr><th scope="row">3.5</th><td><code>3.5</code><code>3.50</code><code>7/2</code></td><td><code>31/2</code><code>3 1/2</code></td></tr>
      <tr><th scope="row"><Content blocks={[{ kind: 'math', latex: '\\frac{2}{3}', accessibleText: 'two thirds' }]} /></th><td><code>2/3</code><code>.6666</code><code>.6667</code><code>0.666</code><code>0.667</code></td><td><code>0.66</code><code>.66</code><code>0.67</code><code>.67</code></td></tr>
      <tr><th scope="row"><Content blocks={[{ kind: 'math', latex: '-\\frac{1}{3}', accessibleText: 'negative one third' }]} /></th><td><code>-1/3</code><code>-.3333</code><code>-0.333</code></td><td><code>-.33</code><code>-0.33</code></td></tr>
    </tbody></table>
  </section>;
}
