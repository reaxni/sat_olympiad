export function NumericDirections() {
  return <section className="numeric-directions" aria-label="Student-produced response directions">
    <h2>Student-produced response directions</h2>
    <ul>
      <li>Enter one response in the answer field, even when more than one form may be possible.</li>
      <li>Use a number, decimal, or fraction. Write a mixed number as an improper fraction or decimal.</li>
      <li>If a fraction is too long for the field, enter a decimal equivalent.</li>
      <li>Do not include units, currency symbols, commas, or percent signs unless the question explicitly asks for them.</li>
    </ul>
    <h3>Input examples</h3>
    <table><thead><tr><th scope="col">Value</th><th scope="col">Example entries</th></tr></thead><tbody>
      <tr><th scope="row">One half</th><td><code>1/2</code> or <code>0.5</code></td></tr>
      <tr><th scope="row">Negative one quarter</th><td><code>-1/4</code> or <code>-0.25</code></td></tr>
    </tbody></table>
    <p>These examples explain the input layout only. The exam service validates responses and determines scoring.</p>
  </section>;
}
