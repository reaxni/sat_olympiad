import type { ReactNode } from 'react';
import { Content } from './Content';
import './MathExam.css';

function Diagram({ title, formula, children }: { title: string; formula?: string; children: ReactNode }) {
  return <div className="sat-reference-diagram"><svg viewBox="0 0 200 140" role="img" aria-label={title}>{children}</svg>{formula && <Content blocks={[{ kind: 'math', latex: formula, accessibleText: title }]} />}</div>;
}

export function ReferenceSheet() {
  return <div className="reference-sheet sat-reference-sheet"><div className="sat-reference-grid">
    <Diagram title="Circle: area pi r squared; circumference 2 pi r" formula={'A=\\pi r^2\\qquad C=2\\pi r'}><circle cx="95" cy="67" r="45" /><circle className="reference-point" cx="95" cy="67" r="3" /><path d="M95 67H140" /><text x="116" y="60">r</text></Diagram>
    <Diagram title="Rectangle: area length times width" formula="A=lw"><rect x="38" y="45" width="120" height="60" /><text x="95" y="34">ℓ</text><text x="165" y="82">w</text></Diagram>
    <Diagram title="Triangle: area one half base times height" formula={'A=\\frac12 bh'}><path d="M35 112L80 22L165 112Z" /><path className="reference-dashed" d="M80 22V112" /><text x="95" y="133">b</text><text x="86" y="75">h</text></Diagram>
    <Diagram title="Right triangle: c squared equals a squared plus b squared" formula="c^2=a^2+b^2"><path d="M42 22V112H168Z" /><path d="M42 99H55V112" /><text x="104" y="133">a</text><text x="25" y="76">b</text><text x="112" y="64">c</text></Diagram>
    <Diagram title="30–60–90 triangle: sides x, x square root of 3, and 2x"><path d="M30 115H165V36Z" /><path d="M151 115V101H165" /><text x="173" y="84">x</text><text x="70" y="136">x√3</text><text x="75" y="62">2x</text><text className="reference-angle" x="56" y="110">30°</text><text className="reference-angle" x="134" y="66">60°</text></Diagram>
    <Diagram title="45–45–90 triangle: legs s and hypotenuse s square root of 2"><path d="M45 25V115H135Z" /><path d="M45 103H57V115" /><text x="28" y="79">s</text><text x="86" y="136">s</text><text x="108" y="67">s√2</text><text className="reference-angle" x="51" y="61">45°</text><text className="reference-angle" x="96" y="109">45°</text></Diagram>
    <h3 className="reference-special-title">Special right triangles</h3>
    <Diagram title="Rectangular prism: volume length times width times height" formula="V=lwh"><path d="M36 55H128V105H36ZM36 55L69 32H162L128 55M128 105L162 82V32" /><path className="reference-dashed" d="M36 105L69 82H162M69 32V82" /><text x="78" y="128">ℓ</text><text x="145" y="109">w</text><text x="170" y="64">h</text></Diagram>
    <Diagram title="Cylinder: volume pi r squared h" formula={'V=\\pi r^2h'}><ellipse cx="94" cy="40" rx="52" ry="18" /><path d="M42 40V102C42 126 146 126 146 102V40" /><path className="reference-dashed" d="M42 102C42 78 146 78 146 102" /><circle className="reference-point" cx="94" cy="40" r="3" /><path d="M94 40L125 29" /><text x="111" y="25">r</text><text x="154" y="80">h</text></Diagram>
    <Diagram title="Sphere: volume four thirds pi r cubed" formula={'V=\\frac43\\pi r^3'}><circle cx="96" cy="71" r="49" /><path d="M47 71C47 97 145 97 145 71" /><path className="reference-dashed" d="M47 71C47 45 145 45 145 71" /><circle className="reference-point" cx="96" cy="71" r="3" /><path d="M96 71H145" /><text x="115" y="65">r</text></Diagram>
    <Diagram title="Cone: volume one third pi r squared h" formula={'V=\\frac13\\pi r^2h'}><path d="M42 110L96 15L150 110C150 135 42 135 42 110ZM96 15V110H150" /><path className="reference-dashed" d="M42 110C42 85 150 85 150 110" /><path d="M96 100H106V110" /><text x="101" y="66">h</text><text x="119" y="105">r</text></Diagram>
    <Diagram title="Rectangular pyramid: volume one third length times width times height" formula={'V=\\frac13 lwh'}><path d="M28 111L95 14L162 80L120 116ZM95 14L120 116" /><path className="reference-dashed" d="M95 14V93M28 111L70 77L162 80M95 14L70 77" /><text x="75" y="137">ℓ</text><text x="144" y="110">w</text><text x="98" y="70">h</text></Diagram>
  </div><div className="reference-angle-facts"><p>The number of degrees of arc in a circle is 360.</p><p>The number of radians of arc in a circle is 2π.</p><p>The sum of the measures in degrees of the angles of a triangle is 180.</p></div></div>;
}
