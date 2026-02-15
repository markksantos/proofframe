import { jsPDF } from 'jspdf';
import type { ScanResult } from '../types/index.ts';

/**
 * Generates and auto-downloads a PDF QA report for a completed scan.
 *
 * The report includes:
 * - Title and metadata (file name, scan date, total errors)
 * - Per-frame error details (spelling + video errors)
 * - Transcript section (if available)
 * - Summary section
 */
export function generateReport(result: ScanResult): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  /**
   * Checks if we need a new page and adds one if necessary.
   */
  function checkPageBreak(requiredSpace: number): void {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + requiredSpace > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // --- Title ---
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('ProofFrame QA Report', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // --- Divider ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Metadata ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'bold');
  doc.text('File:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(result.fileName, margin + 25, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Type:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(result.type === 'image' ? 'Image' : 'Video', margin + 25, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(result.scanDate, margin + 25, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Errors:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(result.totalErrors), margin + 25, y);
  y += 12;

  // --- Video error breakdown ---
  if (result.videoErrorSummary) {
    const s = result.videoErrorSummary;
    doc.setFont('helvetica', 'bold');
    doc.text('Breakdown:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${s.mismatches} mismatches, ${s.spelling} spelling, ${s.missingCaptions} missing captions, ${s.timing} timing`,
      margin + 35,
      y,
    );
    y += 12;
  }

  // --- Divider ---
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Transcript section (video only) ---
  if (result.transcript?.text) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Transcript', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const transcriptLines = doc.splitTextToSize(
      result.transcript.text,
      contentWidth,
    );
    for (const line of transcriptLines) {
      checkPageBreak(6);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 8;

    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  }

  // --- Video Error Details (grouped by type) ---
  const allVideoErrors = result.frames.flatMap((f) => f.videoErrors ?? []);
  if (allVideoErrors.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Video Error Details', margin, y);
    y += 10;

    const errorsByType = {
      mismatch: allVideoErrors.filter((e) => e.type === 'mismatch'),
      spelling: allVideoErrors.filter((e) => e.type === 'spelling'),
      missing_caption: allVideoErrors.filter(
        (e) => e.type === 'missing_caption',
      ),
      timing: allVideoErrors.filter((e) => e.type === 'timing'),
    };

    const typeLabels: Record<string, string> = {
      mismatch: 'Mismatches',
      spelling: 'Spelling Errors',
      missing_caption: 'Missing Captions',
      timing: 'Timing Issues',
    };

    for (const [type, errors] of Object.entries(errorsByType)) {
      if (errors.length === 0) continue;

      checkPageBreak(20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${typeLabels[type]} (${errors.length})`, margin, y);
      y += 7;

      doc.setFontSize(10);
      for (const error of errors) {
        checkPageBreak(25);

        doc.setFont('helvetica', 'bold');
        doc.text(
          `Frame ${error.frameIndex + 1} (${formatTimestamp(error.timestamp)})`,
          margin + 5,
          y,
        );
        y += 5;

        doc.setFont('helvetica', 'normal');
        const msgLines = doc.splitTextToSize(error.message, contentWidth - 10);
        doc.text(msgLines, margin + 10, y);
        y += msgLines.length * 5;

        if (error.onScreenText) {
          const onScreenLines = doc.splitTextToSize(
            `On screen: "${error.onScreenText}"`,
            contentWidth - 10,
          );
          doc.text(onScreenLines, margin + 10, y);
          y += onScreenLines.length * 5;
        }

        if (error.spokenText) {
          const spokenLines = doc.splitTextToSize(
            `Spoken: "${error.spokenText}"`,
            contentWidth - 10,
          );
          doc.text(spokenLines, margin + 10, y);
          y += spokenLines.length * 5;
        }

        if (error.spellingError && error.spellingError.suggestions.length > 0) {
          doc.text(
            `Suggestions: ${error.spellingError.suggestions.join(', ')}`,
            margin + 10,
            y,
          );
          y += 5;
        }

        y += 4;
      }

      y += 5;
    }
  } else {
    // --- Legacy spelling-only error details ---
    const framesWithErrors = result.frames.filter(
      (f) => f.errors.length > 0,
    );

    if (framesWithErrors.length === 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('No spelling errors detected.', pageWidth / 2, y, {
        align: 'center',
      });
      y += 10;
    } else {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Error Details', margin, y);
      y += 10;

      for (const frame of framesWithErrors) {
        checkPageBreak(30);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');

        const frameLabel =
          result.type === 'video'
            ? `Frame ${frame.frameIndex + 1} (${formatTimestamp(frame.timestamp)})`
            : `Frame ${frame.frameIndex + 1}`;
        doc.text(frameLabel, margin, y);
        y += 7;

        doc.setFontSize(10);
        for (const error of frame.errors) {
          checkPageBreak(20);

          doc.setFont('helvetica', 'bold');
          doc.text(`"${error.word}"`, margin + 5, y);

          doc.setFont('helvetica', 'normal');
          const confText = `  (confidence: ${error.confidence.toFixed(1)}%)`;
          doc.text(
            confText,
            margin + 5 + doc.getTextWidth(`"${error.word}"`),
            y,
          );
          y += 6;

          if (error.suggestions.length > 0) {
            const sugText = `Suggestions: ${error.suggestions.join(', ')}`;
            const lines = doc.splitTextToSize(sugText, contentWidth - 10);
            doc.text(lines, margin + 10, y);
            y += lines.length * 5;
          } else {
            doc.text('No suggestions available', margin + 10, y);
            y += 5;
          }

          y += 4;
        }

        y += 5;
      }
    }
  }

  // --- Summary ---
  checkPageBreak(40);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const totalFrames = result.frames.length;
  const framesWithErrorCount = result.frames.filter(
    (f) => f.errors.length > 0 || (f.videoErrors ?? []).length > 0,
  ).length;
  const cleanFrames = totalFrames - framesWithErrorCount;

  doc.text(`Total frames scanned: ${totalFrames}`, margin + 5, y);
  y += 6;
  doc.text(`Frames with errors: ${framesWithErrorCount}`, margin + 5, y);
  y += 6;
  doc.text(`Clean frames: ${cleanFrames}`, margin + 5, y);
  y += 6;
  doc.text(`Total errors found: ${result.totalErrors}`, margin + 5, y);
  y += 10;

  // --- Footer ---
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Generated by ProofFrame',
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  );

  // Auto-download
  const safeName = result.fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`proofframe_report_${safeName}.pdf`);
}

/**
 * Formats a timestamp in seconds to MM:SS format.
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
