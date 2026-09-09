# Bubble effects, measured

Recorded on the iOS 26 simulator (iPhone 17 Pro, 402x874 pt) by sending the same fixture message with
each effect and capturing the screen at 60 fps. Scale is the bubble's measured height over its settled
height; the settled bubble in every recording is 60 pt tall (two lines of 17 pt text on a 20 pt line,
10 pt of padding above and below). Times are from the frame the effects screen leaves.

The bubble is anchored near its final bottom edge throughout: in the Loud recording the bottom stays
within 785-793 while the top travels, so the transform origin is the trailing bottom corner.

## Slam, 640 ms

| t (ms) | scale |
|---|---|
| 50 | 7.7 or more, clipped by the screen |
| 233 | 5.10 |
| 267 | 4.67 |
| 300 | 0.92 |
| 333 | 0.95 |
| 367 | 1.00 |
| 400 | 1.02 |
| 467 | 1.07 |
| 533 | 1.05 |
| 633 | 1.00 |

The bubble arrives far oversized and shrinking, lands **squashed under its size**, then rebounds to
1.07 and settles. Frames from 50 to 233 ms are clipped by the bottom of the screen, so their scales
are lower bounds; the first unclipped frame is 233 ms. The recording jumps 4.67 to 0.92 in a single
frame, which is the slam itself; the two steps between in `message-effects.tsx` are interpolated and
are the only numbers there that are not measured.

## Loud, 1230 ms (starting from the first frame the bubble is visible, 117 ms after the screen leaves)

| t (ms) | scale |
|---|---|
| 0 | 0.32 |
| 33 | 0.58 |
| 83 | 1.02 |
| 183 | 1.75 |
| 283 | 2.12 |
| 350 | 2.23 |
| 450 | 2.35 |
| 550 | 2.27 |
| 683 | 2.32 |
| 783 | 2.20 |
| 883 | 1.87 |
| 1033 | 1.25 |
| 1233 | 1.00 |

It blows up to **2.35x**, jitters a few points at the top of the swell, holds, then falls back. The
jitter is the shake: the measured top edge wanders about 6 pt while the growth curve is smooth.

## Gentle, about 3000 ms

| t (ms) | scale |
|---|---|
| 200 | 0.38 |
| 233 | 0.65 |
| 300 | 0.85 |
| 400 | 1.13 |
| 533 | 1.25 |
| 533-1250 | 1.25, held |
| 1983 | 1.10 |
| 2583 | 1.05 |
| 3083 | 1.00 |

Much slower than the other two. The message arrives at a third of its size, overshoots to 1.25 in half
a second, then takes another two and a half seconds to relax into place.

## Invisible Ink, no motion

The bubble arrives at its final size and stays there. What animates is the cover: the text dissolves
into drifting specks over a full-strength bubble. There is no scale, rotation or opacity change to
measure, which is why `bubbleEffectDuration` is 0 for it.

## Screen effects

iOS 26 offers **eight**, not nine, and the page dots on the Screen tab confirm it: eight dots, and
swiping past the eighth goes nowhere. In order: Echo, Spotlight, Balloons, Confetti, Love, Lasers,
Fireworks, Celebration. Shooting Star is gone.

The dots sit under the preview: 7.67 pt across, 17.62 pt apart, the first centred at x 139.17 and all
of them on y 807. The chosen one is drawn at full strength and the rest at the same reduced opacity
the unchosen row labels use.

None of the eight animations themselves is measured yet.
