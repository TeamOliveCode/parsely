import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker 설정 - 확장 프로그램 내 로컬 파일 사용
pdfjsLib.GlobalWorkerOptions.workerSrc = browser.runtime.getURL('/pdf.worker.min.mjs');

interface TextItem {
  text: string;
  x: number;
  y: number;
  height: number;
  width: number;
}

interface Line {
  text: string;
  y: number;
  x: number;
  width: number;
  height: number;
  pageNum: number;
  endsWithHyphen: boolean;
  startsWithLowercase: boolean;
  endsWithPunctuation: boolean;
}

// 단락 정보 (위치 포함)
export interface ParagraphInfo {
  text: string;
  pageNum: number;
  startY: number;
  endY: number;
  x: number;
  width: number;
}

// 추출 결과
export interface ExtractionResult {
  paragraphs: ParagraphInfo[];
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
}

export class PdfExtractor {
  /**
   * PDF URL에서 텍스트를 추출하여 단락 배열로 반환 (위치 정보 포함)
   */
  static async extractWithPositions(
    source: string | ArrayBuffer,
    onProgress?: (page: number, total: number) => void
  ): Promise<ExtractionResult> {
    const pdf = await pdfjsLib.getDocument(source).promise;
    const totalPages = pdf.numPages;

    // 첫 페이지에서 크기 정보 가져오기
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });

    const allLines: Line[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageLines = await this.extractPageLines(pdf, pageNum);
      allLines.push(...pageLines);

      if (onProgress) {
        onProgress(pageNum, totalPages);
      }
    }

    // 라인들을 단락으로 병합 (위치 정보 포함)
    const paragraphs = this.mergeLinesToParagraphsWithPositions(allLines);

    // 긴 단락 분리 및 정리
    const cleanedParagraphs = this.cleanParagraphsWithPositions(paragraphs);

    return {
      paragraphs: cleanedParagraphs,
      pageCount: totalPages,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
    };
  }

  /**
   * 기존 호환성을 위한 단순 텍스트 추출
   */
  static async extract(
    source: string | ArrayBuffer,
    onProgress?: (page: number, total: number) => void
  ): Promise<string[]> {
    const result = await this.extractWithPositions(source, onProgress);
    return result.paragraphs.map((p) => p.text);
  }

  /**
   * 단일 페이지에서 라인 단위로 텍스트 추출 (2단 레이아웃 처리)
   */
  private static async extractPageLines(
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNum: number
  ): Promise<Line[]> {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    // 텍스트 아이템을 위치 정보와 함께 수집
    const items: TextItem[] = [];
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim() !== '') {
        const textItem = item as any;
        items.push({
          text: textItem.str,
          x: textItem.transform[4],
          y: textItem.transform[5],
          height: textItem.height || Math.abs(textItem.transform[0]) || 10,
          width: textItem.width || 0,
        });
      }
    }

    if (items.length === 0) return [];

    // 2단 레이아웃 감지
    const midX = viewport.width / 2;
    const leftMargin = Math.min(...items.map((i) => i.x));
    const rightItems = items.filter((i) => i.x > midX + 20);

    // 오른쪽 컬럼에 충분한 텍스트가 있으면 2단으로 판단
    const isTwoColumn = rightItems.length > items.length * 0.3;

    if (isTwoColumn) {
      const leftColumn = items.filter((i) => i.x < midX);
      const rightColumn = items.filter((i) => i.x >= midX);

      const leftLines = this.itemsToLines(leftColumn, leftMargin, pageNum);
      const rightLines = this.itemsToLines(rightColumn, midX, pageNum);

      return [...leftLines, ...rightLines];
    } else {
      return this.itemsToLines(items, leftMargin, pageNum);
    }
  }

  /**
   * 텍스트 아이템들을 라인으로 변환
   */
  private static itemsToLines(items: TextItem[], baseX: number, pageNum: number): Line[] {
    if (items.length === 0) return [];

    // Y 좌표로 정렬 (위에서 아래로)
    items.sort((a, b) => b.y - a.y);

    const lines: Line[] = [];
    let currentLineItems: TextItem[] = [];
    let currentY: number | null = null;
    const yThreshold = 3;

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) < yThreshold) {
        currentLineItems.push(item);
        if (currentY === null) currentY = item.y;
      } else {
        if (currentLineItems.length > 0) {
          lines.push(this.createLine(currentLineItems, baseX, pageNum));
        }
        currentLineItems = [item];
        currentY = item.y;
      }
    }

    if (currentLineItems.length > 0) {
      lines.push(this.createLine(currentLineItems, baseX, pageNum));
    }

    return lines;
  }

  /**
   * 텍스트 아이템 배열을 Line 객체로 변환
   */
  private static createLine(items: TextItem[], baseX: number, pageNum: number): Line {
    // X 좌표로 정렬
    items.sort((a, b) => a.x - b.x);

    const text = items
      .map((i) => i.text)
      .join(' ')
      .trim();
    const avgHeight = items.reduce((sum, i) => sum + i.height, 0) / items.length;
    const minX = Math.min(...items.map((i) => i.x));
    const maxX = Math.max(...items.map((i) => i.x + i.width));
    const y = items[0].y;

    return {
      text,
      y,
      x: minX,
      width: maxX - minX,
      height: avgHeight,
      pageNum,
      endsWithHyphen: text.endsWith('-'),
      startsWithLowercase: /^[a-z]/.test(text),
      endsWithPunctuation: /[.!?:;]$/.test(text),
    };
  }

  /**
   * 라인들을 단락으로 병합 (위치 정보 포함)
   */
  private static mergeLinesToParagraphsWithPositions(lines: Line[]): ParagraphInfo[] {
    if (lines.length === 0) return [];

    const paragraphs: ParagraphInfo[] = [];
    let currentText = '';
    let startLine: Line | null = null;
    let endLine: Line | null = null;
    let maxWidth = 0;
    let minX = Infinity;
    let prevLine: Line | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const text = line.text.trim();

      if (!text) continue;

      // 새 단락 시작 조건 판단
      const shouldStartNewParagraph = this.shouldStartNewParagraph(line, prevLine, lines[i + 1]);

      if (shouldStartNewParagraph && currentText && startLine && endLine) {
        paragraphs.push({
          text: currentText.trim(),
          pageNum: startLine.pageNum,
          startY: startLine.y,
          endY: endLine.y - endLine.height,
          x: minX,
          width: maxWidth,
        });
        currentText = '';
        startLine = null;
        endLine = null;
        maxWidth = 0;
        minX = Infinity;
      }

      // 시작 라인 설정
      if (!startLine) {
        startLine = line;
      }
      endLine = line;

      // 위치/크기 정보 업데이트
      minX = Math.min(minX, line.x);
      maxWidth = Math.max(maxWidth, line.width);

      // 하이픈으로 끝나면 하이픈 제거하고 연결
      if (line.endsWithHyphen) {
        currentText += text.slice(0, -1);
      } else if (currentText && !currentText.endsWith(' ')) {
        currentText += ' ' + text;
      } else {
        currentText += text;
      }

      prevLine = line;
    }

    // 마지막 단락 저장
    if (currentText.trim() && startLine && endLine) {
      paragraphs.push({
        text: currentText.trim(),
        pageNum: startLine.pageNum,
        startY: startLine.y,
        endY: endLine.y - endLine.height,
        x: minX,
        width: maxWidth,
      });
    }

    return paragraphs;
  }

  /**
   * 새 단락을 시작해야 하는지 판단
   */
  private static shouldStartNewParagraph(
    currentLine: Line,
    prevLine: Line | null,
    _nextLine: Line | undefined
  ): boolean {
    if (!prevLine) return false;

    // 페이지가 바뀌면 새 단락
    if (currentLine.pageNum !== prevLine.pageNum) {
      return true;
    }

    const text = currentLine.text.trim();

    // 1. 섹션 제목 패턴 감지 (숫자. 또는 숫자.숫자 로 시작)
    if (/^\d+\.?\s+[A-Z]/.test(text) || /^\d+\.\d+\s+[A-Z]/.test(text)) {
      return true;
    }

    // 2. 대문자로만 이루어진 제목
    if (/^[A-Z][A-Z\s]+$/.test(text) && text.length < 50) {
      return true;
    }

    // 3. 이전 줄이 문장 종결 부호로 끝나고, 현재 줄이 대문자로 시작
    if (prevLine.endsWithPunctuation && /^[A-Z]/.test(text)) {
      return true;
    }

    // 4. Y 좌표 간격이 일반 줄 간격보다 큰 경우 (빈 줄 효과)
    const lineGap = prevLine.y - currentLine.y;
    const normalGap = prevLine.height * 1.2;
    if (lineGap > normalGap * 1.8) {
      return true;
    }

    // 5. 들여쓰기 감지
    if (currentLine.x > prevLine.x + 15 && !currentLine.startsWithLowercase) {
      return true;
    }

    // 6. 불릿 포인트나 리스트 아이템
    if (/^[•\-–—]\s/.test(text) || /^\([a-z0-9]\)/.test(text) || /^[a-z]\.\s/.test(text)) {
      return true;
    }

    return false;
  }

  /**
   * 최종 단락 정리 (위치 정보 포함)
   */
  private static cleanParagraphsWithPositions(paragraphs: ParagraphInfo[]): ParagraphInfo[] {
    const MAX_PARAGRAPH_LENGTH = 800;
    const result: ParagraphInfo[] = [];

    for (const p of paragraphs) {
      // 다중 공백 정리
      let cleaned = p.text.replace(/\s+/g, ' ').trim();
      // 하이픈으로 끊어진 단어 복원
      cleaned = cleaned.replace(/(\w+)-\s+(\w+)/g, '$1$2');

      // 필터링
      if (cleaned.length < 20) continue;
      if (/^\d+$/.test(cleaned)) continue;
      if (/^\[\d+\]$/.test(cleaned)) continue;
      if (/^[\w.]+@[\w.]+$/.test(cleaned)) continue;

      // 너무 긴 단락은 문장 단위로 분리
      if (cleaned.length > MAX_PARAGRAPH_LENGTH) {
        const splitTexts = this.splitLongParagraph(cleaned, MAX_PARAGRAPH_LENGTH);
        // 분리된 단락들에 원본 위치 정보 유지
        splitTexts.forEach((text) => {
          result.push({
            ...p,
            text,
          });
        });
      } else {
        result.push({
          ...p,
          text: cleaned,
        });
      }
    }

    return result;
  }

  /**
   * 긴 단락을 문장 단위로 분리
   */
  private static splitLongParagraph(text: string, maxLength: number): string[] {
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const result: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (current.length + sentence.length + 1 <= maxLength) {
        current = current ? current + ' ' + sentence : sentence;
      } else {
        if (current) {
          result.push(current);
        }
        if (sentence.length > maxLength) {
          const forceSplit = this.forceSplitText(sentence, maxLength);
          result.push(...forceSplit);
          current = '';
        } else {
          current = sentence;
        }
      }
    }

    if (current) {
      result.push(current);
    }

    return result;
  }

  /**
   * 문장이 너무 길 때 강제 분리
   */
  private static forceSplitText(text: string, maxLength: number): string[] {
    const result: string[] = [];
    const parts = text.split(/(?<=[,;:])\s+/);

    let current = '';
    for (const part of parts) {
      if (current.length + part.length + 1 <= maxLength) {
        current = current ? current + ' ' + part : part;
      } else {
        if (current) {
          result.push(current);
        }
        if (part.length > maxLength) {
          const words = part.split(/\s+/);
          let wordChunk = '';
          for (const word of words) {
            if (wordChunk.length + word.length + 1 <= maxLength) {
              wordChunk = wordChunk ? wordChunk + ' ' + word : word;
            } else {
              if (wordChunk) result.push(wordChunk);
              wordChunk = word;
            }
          }
          if (wordChunk) result.push(wordChunk);
          current = '';
        } else {
          current = part;
        }
      }
    }

    if (current) {
      result.push(current);
    }

    return result;
  }
}
