/* eslint-disable no-continue, no-restricted-syntax */
import { readFileSync } from 'fs';
import { relative, dirname, basename, resolve } from 'path';
import libCoverage from 'istanbul-lib-coverage';
import Path from 'istanbul-lib-report/lib/path.js';
import pad from 'pad';

const BASE_URL = '/pub/test-coverage-tracker-example-coverage/lcov-report';
const ROOT = process.cwd();
const COVERAGE_FILE = './coverage/coverage-final.json';
const ALL_FILES_PATH = '*';
const ERROR_THRESHOLD = 50;
const WARN_THRESHOLD = 80;

// Parse

const calculateCoverage = (stats) => {
  // { lines: { total: 615, covered: 281, skipped: 0, pct: 45.69 },
  //   statements: { total: 723, covered: 286, skipped: 0, pct: 39.56 },
  //   functions: { total: 169, covered: 76, skipped: 0, pct: 44.97 },
  //   branches: { total: 308, covered: 88, skipped: 0, pct: 28.57 } } }
  if (stats.total === 0) {
    return 100;
  }
  return ((stats.covered + stats.skipped) / stats.total) * 100;
};

const getSimpleCoverage = (summary) => {
  const { statements, branches } = summary.toJSON();
  const statementsCoverage = calculateCoverage(statements);
  if (branches.total === 0) {
    return { percent: statementsCoverage };
  }
  const branchesCoverage = calculateCoverage(branches);
  return {
    percent: statementsCoverage * 0.75 + branchesCoverage * 0.25,
  };
};

const coverageJsonToReport = (json, base) => {
  const map = libCoverage.createCoverageMap(json);
  const globalSummary = libCoverage.createCoverageSummary();

  const report = { '*': {} };

  const summaries = {};
  let commonRoot;

  // inspect and summarize all file coverage objects in the map
  for (const file of map.files()) {
    const folder = `${relative(base, dirname(file))}/`;
    const path = new Path(folder);
    commonRoot = commonRoot ? commonRoot.commonPrefixPath(path) : path;

    if (!summaries[folder]) {
      summaries[folder] = libCoverage.createCoverageSummary();
      report[folder] = { files: {} };
    }
    const fileSummary = map.fileCoverageFor(file).toSummary();
    globalSummary.merge(fileSummary);
    summaries[folder].merge(fileSummary);

    report[folder].files[basename(file)] = getSimpleCoverage(fileSummary);
  }
  report['*'] = getSimpleCoverage(globalSummary);

  const folders = Object.keys(summaries);

  while (folders.length > 1 && summaries[`${commonRoot.toString()}/`]) {
    commonRoot = commonRoot.parent();
  }

  const htmlRoot = commonRoot.toString();
  report['*'].htmlRoot = htmlRoot ? `${htmlRoot}/` : '';
  const commonRootLength = htmlRoot ? htmlRoot.length + 1 : 0;

  for (const folder of folders) {
    Object.assign(report[folder], getSimpleCoverage(summaries[folder]));
    report[folder].htmlPath = folder.substring(commonRootLength);
  }

  return report;
};

const parseFile = (base, coveragePath) => {
  const json = JSON.parse(readFileSync(coveragePath, 'utf8'));
  return coverageJsonToReport(json, base);
};

// Format

const getEmoji = (percent) => {
  if (percent === 0) {
    return '❌';
  }
  if (percent < ERROR_THRESHOLD) {
    return '💔';
  }
  if (percent < WARN_THRESHOLD) {
    return '💛';
  }
  if (percent === 100) {
    return '✅';
  }
  return '💚';
};

const getDeltaEmoji = (delta, percent) => {
  if (percent === 0) {
    return '😱';
  }
  if (delta < -10) {
    return '😡';
  }
  if (delta < -5) {
    return '😭';
  }
  if (delta < 0) {
    return '😥';
  }
  if (percent === 100) {
    return '🎉';
  }
  if (delta > 50) {
    return '😍';
  }
  if (delta > 10) {
    return '😀';
  }
  /* delta should never be zero */
  return '🙂';
};

const getPercent = (stats) => stats.percent;

const formatPercent = (percent, padding) =>
  `${pad(padding, percent.toFixed(2))}% ${getEmoji(percent)}`;

const formatPercentDelta = (percent, priorPercent, padding) => {
  const delta = percent - priorPercent;
  return `${pad(padding, (delta > 0 ? '+' : '') + delta.toFixed(2))}% ${getDeltaEmoji(delta, percent)}`;
};

const formatDiffStats = (stats, priorStats, padding = 7) => {
  const percent = getPercent(stats);
  if (!priorStats) {
    return formatPercent(percent, padding);
  }
  const oldPercent = getPercent(priorStats);
  if (percent === oldPercent) {
    return `${formatPercent(percent, padding)} ${pad(padding, '(no change)')}`;
  }
  return `${formatPercent(percent, padding)} ${formatPercentDelta(percent, oldPercent, padding)}`;
};

const format = (report, baseUrl = undefined) => {
  const formatLink = (name, link) => {
    if (!baseUrl) {
      return name;
    }
    return `<a href="${baseUrl}/${link}">${name}</a>`;
  };

  const allRows = [];

  for (const path of Object.keys(report)) {
    if (path === ALL_FILES_PATH) {
      continue;
    }

    const folderReport = report[path];
    const { htmlPath } = folderReport;

    allRows.push({
      label: path,
      link: `${htmlPath}index.html`,
      stats: folderReport,
    });

    for (const file of Object.keys(folderReport.files)) {
      const fileStats = folderReport.files[file];

      allRows.push({
        label: `  ${basename(file)}`,
        link: `${htmlPath}${file}.html`,
        stats: fileStats,
      });
    }
  }

  function getTable(rows) {
    const comment = [];
    if (rows.length > 0) {
      const maxLabelLength = Math.max.apply(
        Math.max,
        rows.map(({ label }) => label.length),
      );
      comment.push('<pre>');
      for (const { label, link, stats, priorStats } of rows) {
        comment.push(
          `${formatLink(pad(label, maxLabelLength), link)}  ${formatDiffStats(stats, priorStats)}`,
        );
      }
      comment.push('</pre>');
    }
    return comment.join('\n');
  }

  return {
    status: formatDiffStats(report[ALL_FILES_PATH], 0),
    folders: getTable(allRows),
  };
};

// Main
const coverage = parseFile(ROOT, resolve(ROOT, COVERAGE_FILE));

const { status, folders } = format(coverage, BASE_URL);

const output = `
## [Code Coverage](${BASE_URL}/index.html): ${status}

${folders}
`;

console.log(output);

/* eslint-enable no-continue, no-restricted-syntax */
