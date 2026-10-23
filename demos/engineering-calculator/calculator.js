(function () {
  'use strict';

  const MODES = {
    ohm: { fields: ['voltage', 'resistance'], example: { voltage: '5', resistance: '1000' } },
    rc: { fields: ['resistance', 'capacitance'], example: { resistance: '10', capacitance: '10' } },
    divider: { fields: ['voltage', 'top', 'bottom'], example: { voltage: '5', top: '10', bottom: '10' } }
  };
  const FIELD_NAMES = { voltage: 'Voltage', resistance: 'Resistance', capacitance: 'Capacitance', top: 'Top resistance', bottom: 'Bottom resistance' };

  function invalid(message, field) {
    const error = new Error(message);
    error.field = field;
    return error;
  }

  function parseFiniteNumber(raw, field) {
    const label = FIELD_NAMES[field] || 'Value';
    if (typeof raw !== 'string' && typeof raw !== 'number') throw invalid(label + ' needs a finite number.', field);
    const text = String(raw).trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
      throw invalid(label + ' needs a number. Use a decimal point or scientific notation.', field);
    }
    const value = Number(text);
    if (!Number.isFinite(value)) throw invalid(label + ' is outside the supported finite-number range.', field);
    return value;
  }

  function formatNumber(value) {
    return Number(value.toPrecision(6)).toString();
  }

  function currentDisplay(amperes) {
    const magnitude = Math.abs(amperes);
    if (magnitude >= 0.001 && magnitude < 1) return formatNumber(amperes * 1000) + ' mA';
    if (magnitude >= 0.000001 && magnitude < 0.001) return formatNumber(amperes * 1000000) + ' µA';
    return formatNumber(amperes) + ' A';
  }

  function calculate(mode, rawValues) {
    if (!Object.prototype.hasOwnProperty.call(MODES, mode)) throw invalid('Choose one of the three available calculations.');
    const values = {};
    MODES[mode].fields.forEach(function (field) {
      values[field] = parseFiniteNumber(rawValues && rawValues[field], field);
      if (field !== 'voltage' && values[field] <= 0) throw invalid(FIELD_NAMES[field] + ' must be greater than zero.', field);
    });

    const n = formatNumber;
    let value, answer, formula, steps, unit;
    if (mode === 'ohm') {
      value = values.voltage / values.resistance;
      unit = 'A';
      formula = 'I = V / R';
      if (!Number.isFinite(value) || (values.voltage !== 0 && value === 0)) throw invalid('This current is outside the supported numeric range. Try less extreme values.');
      answer = currentDisplay(value);
      steps = ['I = ' + n(values.voltage) + ' V / ' + n(values.resistance) + ' Ω', 'I = ' + n(value) + ' A' + (answer.endsWith(' A') ? '' : ' = ' + answer)];
    } else if (mode === 'rc') {
      // kΩ × µF = 10³ Ω × 10⁻⁶ F = 10⁻³ s = ms.
      value = values.resistance * values.capacitance;
      unit = 'ms';
      formula = 'τ = R × C';
      if (!Number.isFinite(value) || value === 0) throw invalid('This time constant is outside the supported numeric range. Try less extreme values.');
      answer = n(value) + ' ms';
      steps = ['τ = ' + n(values.resistance) + ' kΩ × ' + n(values.capacitance) + ' µF', '1 kΩ × 1 µF = 1 ms', 'τ = ' + answer];
    } else {
      const total = values.top + values.bottom;
      if (!Number.isFinite(total)) throw invalid('The sum of the resistances exceeds the supported numeric range. Try smaller values.');
      value = values.voltage * (values.bottom / total);
      unit = 'V';
      formula = 'Vout = Vin × Rbottom / (Rtop + Rbottom)';
      if (!Number.isFinite(value) || (values.voltage !== 0 && value === 0)) throw invalid('This output voltage is outside the supported numeric range. Try less extreme values.');
      answer = n(value) + ' V';
      steps = ['Rtop + Rbottom = ' + n(values.top) + ' kΩ + ' + n(values.bottom) + ' kΩ = ' + n(total) + ' kΩ', 'Vout = ' + n(values.voltage) + ' V × ' + n(values.bottom) + ' kΩ / ' + n(total) + ' kΩ', 'Vout = ' + answer + ' across the bottom resistor'];
    }
    return { mode: mode, value: value, unit: unit, answer: answer, formula: formula, steps: steps };
  }

  function initialise() {
    const form = document.getElementById('calculator-form');
    if (!form) return;
    const select = document.getElementById('calculation-mode');
    const result = document.getElementById('result-message');
    const groups = Array.from(form.querySelectorAll('fieldset[data-mode]'));
    let state = 'ready';

    function paragraph(className, text) {
      const element = document.createElement('p');
      element.className = className;
      element.textContent = text;
      return element;
    }

    function activeGroup() {
      return groups.find(function (group) { return group.dataset.mode === select.value; });
    }

    function resetValidity() {
      form.querySelectorAll('input').forEach(function (input) {
        input.removeAttribute('aria-invalid');
        input.setAttribute('aria-describedby', 'input-help');
      });
    }

    function pending() {
      resetValidity();
      if (state === 'pending') return;
      result.replaceChildren(paragraph('result-state', 'Ready to calculate'), paragraph('', 'Inputs changed. Calculate to see the updated answer and steps.'));
      state = 'pending';
    }

    function showMode() {
      groups.forEach(function (group) {
        const active = group.dataset.mode === select.value;
        group.hidden = !active;
        group.disabled = !active;
      });
      pending();
    }

    function run() {
      resetValidity();
      result.replaceChildren();
      const inputs = Array.from(activeGroup().querySelectorAll('input'));
      const raw = {};
      inputs.forEach(function (input) { raw[input.name] = input.value; });
      try {
        const calculation = calculate(select.value, raw);
        const steps = document.createElement('ol');
        steps.className = 'result-steps';
        calculation.steps.forEach(function (text) {
          const step = document.createElement('li');
          step.textContent = text;
          steps.appendChild(step);
        });
        result.append(paragraph('result-state', 'Calculated locally'), paragraph('result-answer', calculation.answer), paragraph('result-formula', calculation.formula), steps);
        state = 'success';
      } catch (error) {
        const message = paragraph('result-error', error.message);
        message.id = 'calculation-error';
        result.append(paragraph('result-state', 'Check your inputs'), message);
        const badInput = inputs.find(function (input) { return input.name === error.field; });
        if (badInput) {
          badInput.setAttribute('aria-invalid', 'true');
          badInput.setAttribute('aria-describedby', 'input-help calculation-error');
          badInput.focus();
        }
        state = 'error';
      }
    }

    form.addEventListener('submit', function (event) { event.preventDefault(); run(); });
    form.addEventListener('input', pending);
    select.addEventListener('change', showMode);
    document.getElementById('example-button').addEventListener('click', function () {
      const example = MODES[select.value].example;
      activeGroup().querySelectorAll('input').forEach(function (input) { input.value = example[input.name]; });
      run();
    });
    document.getElementById('calculate-button').disabled = false;
    document.getElementById('example-button').disabled = false;
    showMode();
    run();
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { calculate: calculate, parseFiniteNumber: parseFiniteNumber, formatNumber: formatNumber };
  if (typeof document !== 'undefined') initialise();
}());
