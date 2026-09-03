import type { Challenge } from './challenges';

const verilogLanguages = new Set<Challenge['language']>(['Verilog-2005', 'SystemVerilog/UVM']);

/**
 * Formats ANSI-style module ports for reading without changing design behavior.
 * It intentionally leaves procedural code untouched: this is not a Verilog parser.
 */
export function formatCodeForEditor(source: string, language: Challenge['language']) {
  if (!verilogLanguages.has(language)) return source;
  return source.replace(
    /module\s+([A-Za-z_]\w*)(\s*#\s*\([\s\S]*?\))?\s*\(([\s\S]*?)\)\s*;/g,
    (_whole, name: string, parameters: string | undefined, rawPorts: string) => {
      const ports = rawPorts.split(',').map((port) => port.trim()).filter(Boolean);
      if (ports.length < 2) return _whole;

      let declaration = '';
      const lines = ports.map((port) => {
        const match = port.match(/^((?:input|output|inout)\s+(?:(?:wire|reg|logic)\s+)?(?:(?:signed|unsigned)\s+)?(?:\[[^\]]+\]\s*)?)(.+)$/);
        if (match) {
          declaration = match[1].replace(/\s+/g, ' ').trimEnd() + ' ';
          return declaration + match[2].trim();
        }
        return declaration ? declaration + port : port;
      });

      const parameterText = parameters ? parameters.replace(/\s+/g, ' ').trim() : '';
      return `module ${name}${parameterText ? ` ${parameterText}` : ''}(\n  ${lines.join(',\n  ')}\n);`;
    },
  );
}
