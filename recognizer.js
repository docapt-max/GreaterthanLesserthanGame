/**
 * Handwriting Recognition Module for '<', '>', and '='
 * Zero-dependency vanilla JavaScript using pure stroke-point geometric analysis.
 */

const HandwritingCanvas = (function () {
    let canvas = null;
    let ctx = null;
    let card = null;
    let hint = null;
    let clearBtn = null;

    let isEnabled = true;
    let isDrawing = false;
    let currentStroke = [];
    let strokes = [];
    let evalTimer = null;
    let onSymbolRecognizedCallback = null;

    // Line drawing styling
    const STROKE_COLOR = '#38bdf8'; // Vibrant cyan-blue
    const STROKE_WIDTH = 5.5;

    /**
     * Initialize the handwriting canvas on the specified elements.
     */
    function init(options) {
        canvas = document.getElementById(options.canvasId || 'handwriting-canvas');
        card = document.getElementById(options.cardId || 'canvas-card');
        hint = document.getElementById(options.hintId || 'canvas-hint');
        clearBtn = document.getElementById(options.clearBtnId || 'btn-clear-canvas');

        if (options.onSymbolRecognized) {
            onSymbolRecognizedCallback = options.onSymbolRecognized;
        }

        if (!canvas) return;

        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Pointer event listeners with touch-action: none
        canvas.style.touchAction = 'none';
        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', handlePointerUp);
        canvas.addEventListener('pointercancel', handlePointerUp);

        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                clear();
            });
        }
    }

    /**
     * Handle high-DPI scaling for crisp lines on iPad Retina screens.
     */
    function resizeCanvas() {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);

        if (ctx) {
            ctx.scale(dpr, dpr);
            redrawAllStrokes();
        }
    }

    /**
     * Convert pointer event client coordinates to canvas CSS coordinates.
     */
    function getCanvasCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * Compute path length of a stroke.
     */
    function computeStrokeLength(pts) {
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
            len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        return len;
    }

    /**
     * Compute bounding box of a point set.
     */
    function computeBoundingBox(pts) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        return {
            minX, maxX, minY, maxY,
            width: Math.max(0, maxX - minX),
            height: Math.max(0, maxY - minY)
        };
    }

    /**
     * Pointerdown: start a new stroke and reset any pending evaluation.
     */
    function handlePointerDown(e) {
        if (!isEnabled) return;
        e.preventDefault();

        try {
            canvas.setPointerCapture(e.pointerId);
        } catch (_) {}

        // Reset evaluation timer when a new stroke begins
        if (evalTimer) {
            clearTimeout(evalTimer);
            evalTimer = null;
        }

        // Hide watermark hint when drawing begins
        if (hint) {
            hint.style.opacity = '0';
        }

        isDrawing = true;
        const pt = getCanvasCoordinates(e);
        currentStroke = [pt];

        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = STROKE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
    }

    /**
     * Pointermove: append points and render line segment.
     */
    function handlePointerMove(e) {
        if (!isDrawing || !isEnabled) return;
        e.preventDefault();

        const pt = getCanvasCoordinates(e);
        currentStroke.push(pt);

        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
    }

    /**
     * Pointerup / pointercancel: finalize stroke, filter micro-taps, trigger auto-eval timer.
     */
    function handlePointerUp(e) {
        if (!isDrawing) return;
        isDrawing = false;

        try {
            canvas.releasePointerCapture(e.pointerId);
        } catch (_) {}

        // Filter out micro-strokes/accidental taps shorter than 15px
        const strokeLen = computeStrokeLength(currentStroke);
        const bbox = computeBoundingBox(currentStroke);
        const diag = Math.hypot(bbox.width, bbox.height);

        if (strokeLen >= 15 || diag >= 15) {
            strokes.push(currentStroke);
        }
        currentStroke = [];

        redrawAllStrokes();

        if (strokes.length > 0) {
            // Auto-evaluate 450ms after the last pointerup event
            if (evalTimer) clearTimeout(evalTimer);
            evalTimer = setTimeout(() => {
                evaluateDrawing();
            }, 450);
        } else {
            // If all strokes were discarded, restore hint
            if (hint) hint.style.opacity = '1';
        }
    }

    /**
     * Redraw all committed strokes on the canvas cleanly.
     */
    function redrawAllStrokes() {
        if (!ctx || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = STROKE_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const stroke of strokes) {
            if (stroke.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) {
                ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            ctx.stroke();
        }
    }

    /**
     * Strict Geometric Recognizer for '=', '<', and '>'.
     * Returns '<', '>', '=', or null.
     */
    function recognize(strokeList) {
        if (!strokeList || strokeList.length === 0 || strokeList.length > 2) {
            return null; // More than 2 strokes strictly rejected
        }

        // 1. Check for '=' (Requires exactly 2 strokes)
        if (strokeList.length === 2) {
            const isEquals = checkEquals(strokeList[0], strokeList[1]);
            if (isEquals) return '=';
        }

        // 2. Check for '<' and '>' (Supports 1-stroke and 2-stroke chevrons)
        if (strokeList.length === 1) {
            const sym = checkChevron1Stroke(strokeList[0]);
            if (sym) return sym;
        } else if (strokeList.length === 2) {
            const sym = checkChevron2Strokes(strokeList[0], strokeList[1]);
            if (sym) return sym;
        }

        return null;
    }

    /**
     * Geometric rule for '=':
     * - Exactly 2 strokes.
     * - Both nearly horizontal (|dy| < 0.35 * |dx|).
     * - Similar in width (within 50% of each other).
     * - Horizontally aligned (overlapping X ranges).
     * - Vertically separated without crossing.
     */
    function checkEquals(s0, s1) {
        if (s0.length < 2 || s1.length < 2) return false;

        function analyzeHorizontalStroke(pts) {
            const start = pts[0];
            const end = pts[pts.length - 1];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            // Must have meaningful width (>= 15px) and nearly horizontal (|dy| < 0.35 * |dx|)
            if (absDx < 14 || absDy >= 0.35 * absDx) return null;

            const bbox = computeBoundingBox(pts);
            if (bbox.width < 15) return null;
            // Reject loops or vertical wiggles
            if (bbox.height > 0.45 * bbox.width && bbox.height > 18) return null;

            let sumY = 0;
            for (const p of pts) sumY += p.y;
            const avgY = sumY / pts.length;

            return {
                minX: bbox.minX,
                maxX: bbox.maxX,
                minY: bbox.minY,
                maxY: bbox.maxY,
                width: bbox.width,
                height: bbox.height,
                avgY
            };
        }

        const h0 = analyzeHorizontalStroke(s0);
        const h1 = analyzeHorizontalStroke(s1);
        if (!h0 || !h1) return false;

        // Similar in width (within 50% of each other)
        const maxW = Math.max(h0.width, h1.width);
        const minW = Math.min(h0.width, h1.width);
        if (maxW === 0 || (maxW - minW) / maxW > 0.50) return false;

        // Horizontally aligned (overlapping X ranges)
        const overlapStart = Math.max(h0.minX, h1.minX);
        const overlapEnd = Math.min(h0.maxX, h1.maxX);
        const overlapWidth = overlapEnd - overlapStart;
        if (overlapWidth <= 0 || overlapWidth < 0.40 * minW) return false;

        // Vertically separated without crossing
        const topStroke = h0.avgY < h1.avgY ? h0 : h1;
        const botStroke = h0.avgY < h1.avgY ? h1 : h0;

        const vertSeparation = botStroke.avgY - topStroke.avgY;
        if (vertSeparation < 8 || vertSeparation > 80) return false;

        // Top stroke must not cross into bottom stroke
        if (topStroke.maxY > botStroke.minY + 6) return false;

        return true;
    }

    /**
     * Geometric rule for 1-stroke '<' and '>':
     * - height > 25px, width > 15px.
     * - Reject closed loops (start and end points too close together).
     * - Reject straight lines (insufficient horizontal bend/apex).
     * - Direction-agnostic classification:
     *   - '<': leftmost extreme point (apex) in middle vertical third [0.20, 0.80],
     *          both endpoints clearly to the right.
     *   - '>': rightmost extreme point (apex) in middle vertical third [0.20, 0.80],
     *          both endpoints clearly to the left.
     */
    function checkChevron1Stroke(pts) {
        if (pts.length < 5) return null;

        const bbox = computeBoundingBox(pts);
        const width = bbox.width;
        const height = bbox.height;

        // Require sufficient vertical height (> 25px) and horizontal depth (> 15px)
        if (height <= 25 || width <= 15) return null;

        const startPt = pts[0];
        const endPt = pts[pts.length - 1];

        // Reject closed loops (start and end points too close together)
        const endpointDist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
        if (endpointDist < 16 || endpointDist < 0.22 * Math.max(width, height)) {
            return null; // loop (O, circle, triangle, square)
        }

        // Endpoints must have significant vertical separation
        const vertSpan = Math.abs(startPt.y - endPt.y);
        if (vertSpan < 0.30 * height) return null;

        const hasTopAndBottom = (
            (startPt.y < bbox.minY + 0.55 * height && endPt.y > bbox.minY + 0.45 * height) ||
            (endPt.y < bbox.minY + 0.55 * height && startPt.y > bbox.minY + 0.45 * height)
        );
        if (!hasTopAndBottom) return null;

        // --- Test for '<' (Leftmost extreme apex) ---
        let leftApexIdx = -1;
        let minXVal = Infinity;
        for (let i = 0; i < pts.length; i++) {
            if (pts[i].x < minXVal) {
                minXVal = pts[i].x;
                leftApexIdx = i;
            }
        }
        const leftApex = pts[leftApexIdx];
        const leftRatioY = (leftApex.y - bbox.minY) / height;
        const leftApexInMiddle = (leftRatioY >= 0.20 && leftRatioY <= 0.80);
        const bothRightOfApex = (
            startPt.x - leftApex.x > 0.38 * width &&
            endPt.x - leftApex.x > 0.38 * width &&
            Math.min(startPt.x - leftApex.x, endPt.x - leftApex.x) > 12
        );
        // Apex must be internal to reject straight lines
        const leftApexInternal = (leftApexIdx >= 0.10 * pts.length && leftApexIdx <= 0.90 * pts.length);

        if (leftApexInMiddle && bothRightOfApex && leftApexInternal) {
            return '<';
        }

        // --- Test for '>' (Rightmost extreme apex) ---
        let rightApexIdx = -1;
        let maxXVal = -Infinity;
        for (let i = 0; i < pts.length; i++) {
            if (pts[i].x > maxXVal) {
                maxXVal = pts[i].x;
                rightApexIdx = i;
            }
        }
        const rightApex = pts[rightApexIdx];
        const rightRatioY = (rightApex.y - bbox.minY) / height;
        const rightApexInMiddle = (rightRatioY >= 0.20 && rightRatioY <= 0.80);
        const bothLeftOfApex = (
            rightApex.x - startPt.x > 0.38 * width &&
            rightApex.x - endPt.x > 0.38 * width &&
            Math.min(rightApex.x - startPt.x, rightApex.x - endPt.x) > 12
        );
        const rightApexInternal = (rightApexIdx >= 0.10 * pts.length && rightApexIdx <= 0.90 * pts.length);

        if (rightApexInMiddle && bothLeftOfApex && rightApexInternal) {
            return '>';
        }

        return null;
    }

    /**
     * Geometric rule for 2-stroke '<' and '>' meeting near an apex:
     */
    function checkChevron2Strokes(s0, s1) {
        if (s0.length < 2 || s1.length < 2) return null;

        const combinedPts = [...s0, ...s1];
        const bbox = computeBoundingBox(combinedPts);
        const width = bbox.width;
        const height = bbox.height;

        if (height <= 25 || width <= 15) return null;

        const ends0 = [s0[0], s0[s0.length - 1]];
        const ends1 = [s1[0], s1[s1.length - 1]];

        let minMeetingDist = Infinity;
        let meetingPair = null;

        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                const d = Math.hypot(ends0[i].x - ends1[j].x, ends0[i].y - ends1[j].y);
                if (d < minMeetingDist) {
                    minMeetingDist = d;
                    meetingPair = {
                        meetPt0: ends0[i],
                        meetPt1: ends1[j],
                        outerPt0: ends0[1 - i],
                        outerPt1: ends1[1 - j]
                    };
                }
            }
        }

        const allowedMeetingDist = Math.max(26, 0.35 * Math.max(width, height));
        if (minMeetingDist > allowedMeetingDist) return null;

        const apex = {
            x: (meetingPair.meetPt0.x + meetingPair.meetPt1.x) / 2,
            y: (meetingPair.meetPt0.y + meetingPair.meetPt1.y) / 2
        };

        const out0 = meetingPair.outerPt0;
        const out1 = meetingPair.outerPt1;

        // Reject loops
        const outerDist = Math.hypot(out0.x - out1.x, out0.y - out1.y);
        if (outerDist < 16 || outerDist < 0.25 * height) return null;

        const hasTopAndBottom = (
            (out0.y < bbox.minY + 0.55 * height && out1.y > bbox.minY + 0.45 * height) ||
            (out1.y < bbox.minY + 0.55 * height && out0.y > bbox.minY + 0.45 * height)
        );
        if (!hasTopAndBottom) return null;

        const apexRatioY = (apex.y - bbox.minY) / height;
        if (apexRatioY < 0.20 || apexRatioY > 0.80) return null;

        // '<': apex on left, outer endpoints clearly to right
        const isLeftApex = (apex.x - bbox.minX < 0.30 * width);
        const bothRightOfApex = (out0.x - apex.x > 0.35 * width && out1.x - apex.x > 0.35 * width);
        if (isLeftApex && bothRightOfApex) {
            return '<';
        }

        // '>': apex on right, outer endpoints clearly to left
        const isRightApex = (bbox.maxX - apex.x < 0.30 * width);
        const bothLeftOfApex = (apex.x - out0.x > 0.35 * width && apex.x - out1.x > 0.35 * width);
        if (isRightApex && bothLeftOfApex) {
            return '>';
        }

        return null;
    }

    /**
     * Trigger evaluation: called 450ms after the last stroke.
     */
    function evaluateDrawing() {
        if (!isEnabled || strokes.length === 0) return;

        const recognizedSymbol = recognize(strokes);

        if (recognizedSymbol) {
            // Success recognition!
            triggerFeedback('success', recognizedSymbol);
            if (typeof onSymbolRecognizedCallback === 'function') {
                onSymbolRecognizedCallback(recognizedSymbol);
            } else if (typeof window.onSymbolRecognized === 'function') {
                window.onSymbolRecognized(recognizedSymbol);
            }
        } else {
            // Strict rejection: shake feedback and auto-clear so player can retry
            triggerFeedback('reject');
        }
    }

    /**
     * Visual feedback for rejection or recognition success.
     */
    function triggerFeedback(type, symbol) {
        if (!card) return;

        if (type === 'reject') {
            card.classList.remove('canvas-shake', 'canvas-success');
            void card.offsetWidth; // Force reflow
            card.classList.add('canvas-shake');

            // Play subtle rejection click / thud sound
            playRejectionSound();

            setTimeout(() => {
                if (card) card.classList.remove('canvas-shake');
                clear();
            }, 380);
        } else if (type === 'success') {
            card.classList.remove('canvas-shake', 'canvas-success');
            void card.offsetWidth;
            card.classList.add('canvas-success');

            setTimeout(() => {
                if (card) card.classList.remove('canvas-success');
            }, 500);
        }
    }

    /**
     * Subtle audio feedback on rejection.
     */
    function playRejectionSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (_) {}
    }

    /**
     * Clear all strokes and wipe the canvas.
     */
    function clear() {
        if (evalTimer) {
            clearTimeout(evalTimer);
            evalTimer = null;
        }
        strokes = [];
        currentStroke = [];
        isDrawing = false;

        if (ctx && canvas) {
            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
        }

        if (hint) {
            hint.style.opacity = '1';
        }
    }

    function enable() {
        isEnabled = true;
        if (canvas) canvas.style.pointerEvents = 'auto';
    }

    function disable() {
        isEnabled = false;
        if (evalTimer) {
            clearTimeout(evalTimer);
            evalTimer = null;
        }
        if (canvas) canvas.style.pointerEvents = 'none';
    }

    function setOnSymbolRecognized(fn) {
        onSymbolRecognizedCallback = fn;
    }

    return {
        init,
        clear,
        enable,
        disable,
        resize: resizeCanvas,
        recognize,
        setOnSymbolRecognized
    };
})();

// Expose on global window
window.HandwritingCanvas = HandwritingCanvas;
