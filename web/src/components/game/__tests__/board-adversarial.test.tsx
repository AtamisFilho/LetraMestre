// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BoardView } from "../board";
import { createEmptyBoard, withTilePlaced, SIZE, CENTER } from "@/lib/game/board";
import type { Tile, Board } from "@/lib/game/types";

// vitest.config.ts has globals:false — explicit cleanup is needed.
afterEach(() => cleanup());

function makeTile(letter: string, value: number, opts: Partial<Tile> = {}): Tile {
  return {
    letter,
    value,
    isBlank: opts.isBlank ?? false,
    assignedLetter: opts.assignedLetter,
    id: opts.id ?? `tile_${letter}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

function cell(row: number, col: number) {
  return document.querySelector<HTMLElement>(`[data-cell="${row}-${col}"]`);
}

describe("BoardView: ARIA grid structure", () => {
  it("renders a role=grid container with accessible name '15 por 15'", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-label", "Tabuleiro de jogo 15 por 15");
  });

  it("grid has aria-rowcount=15 and aria-colcount=15", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-rowcount", "15");
    expect(grid).toHaveAttribute("aria-colcount", "15");
  });

  it("renders exactly 225 gridcell roles for an empty board", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(SIZE * SIZE);
    expect(cells).toHaveLength(225);
  });

  it("renders 15 row elements with role=row", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(15);
  });

  it("each row has aria-rowindex 1..15", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const rows = screen.getAllByRole("row");
    rows.forEach((row, i) => {
      expect(row).toHaveAttribute("aria-rowindex", String(i + 1));
    });
  });

  it("each gridcell has aria-rowindex and aria-colindex (1-indexed)", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const firstCell = cell(0, 0)!;
    expect(firstCell).toHaveAttribute("aria-rowindex", "1");
    expect(firstCell).toHaveAttribute("aria-colindex", "1");
    const lastCell = cell(14, 14)!;
    expect(lastCell).toHaveAttribute("aria-rowindex", "15");
    expect(lastCell).toHaveAttribute("aria-colindex", "15");
  });
});

describe("BoardView: bonus cell aria-labels", () => {
  it("CENTER (7,7) aria-label contains 'centro' and 'palavra dupla'", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const center = cell(CENTER, CENTER)!;
    expect(center).toHaveAttribute("aria-label");
    expect(center.getAttribute("aria-label")).toMatch(/centro/i);
    expect(center.getAttribute("aria-label")).toMatch(/palavra dupla/i);
  });

  it("TRIPLE_WORD (0,0) aria-label contains 'palavra tripla'", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(0, 0)!;
    expect(c.getAttribute("aria-label")).toMatch(/palavra tripla/i);
  });

  it("DOUBLE_WORD (1,1) aria-label contains 'palavra dupla'", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(1, 1)!;
    expect(c.getAttribute("aria-label")).toMatch(/palavra dupla/i);
  });

  it("TRIPLE_LETTER (1,5) aria-label contains 'letra tripla'", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(1, 5)!;
    expect(c.getAttribute("aria-label")).toMatch(/letra tripla/i);
  });

  it("DOUBLE_LETTER (0,3) aria-label contains 'letra dupla'", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(0, 3)!;
    expect(c.getAttribute("aria-label")).toMatch(/letra dupla/i);
  });

  it("empty non-bonus cell (0,1) aria-label contains 'vazia' and no bonus text", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(0, 1)!; // (0,1) is NONE — not in any bonus list
    expect(c.getAttribute("aria-label")).toMatch(/vazia/i);
    expect(c.getAttribute("aria-label")).not.toMatch(/bônus/i);
  });

  it("every empty bonus cell has an sr-only span with the full description", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const center = cell(CENTER, CENTER)!;
    const srOnly = center.querySelector(".sr-only");
    expect(srOnly).not.toBeNull();
    expect(srOnly?.textContent).toMatch(/centro/i);
  });
});

describe("BoardView: placed tile aria-labels", () => {
  it("a placed tile's aria-label contains the letter and value", () => {
    const t = makeTile("C", 2);
    const board = withTilePlaced(createEmptyBoard(), 7, 7, t, true);
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(7, 7)!;
    expect(c.getAttribute("aria-label")).toMatch(/peça C/i);
    expect(c.getAttribute("aria-label")).toMatch(/valor 2/i);
  });

  it("a newly-placed tile's aria-label contains 'recém-colocada'", () => {
    const t = makeTile("A", 1);
    const board = withTilePlaced(createEmptyBoard(), 7, 7, t, true);
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(7, 7)!;
    expect(c.getAttribute("aria-label")).toMatch(/recém-colocada/i);
  });

  it("a non-newly-placed tile's aria-label does NOT contain 'recém-colocada'", () => {
    const t = makeTile("A", 1);
    const board = withTilePlaced(createEmptyBoard(), 7, 7, t, false);
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(7, 7)!;
    expect(c.getAttribute("aria-label")).not.toMatch(/recém-colocada/i);
  });

  it("a blank tile's aria-label contains 'curinga'", () => {
    const t = makeTile(" ", 0, { isBlank: true });
    const board = withTilePlaced(createEmptyBoard(), 7, 7, t, true);
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(7, 7)!;
    expect(c.getAttribute("aria-label")).toMatch(/curinga/i);
  });

  it("a blank tile with assignedLetter shows the assigned letter in the aria-label", () => {
    const t = makeTile(" ", 0, { isBlank: true, assignedLetter: "C" });
    const board = withTilePlaced(createEmptyBoard(), 7, 7, t, true);
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(7, 7)!;
    expect(c.getAttribute("aria-label")).toMatch(/curinga/i);
    expect(c.getAttribute("aria-label")).toMatch(/atribuída C/i);
  });

  it("a tile with value 0 (blank) does NOT render the value span", () => {
    const t = makeTile(" ", 0, { isBlank: true });
    const board = withTilePlaced(createEmptyBoard(), 7, 7, t, true);
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(7, 7)!;
    expect(c.querySelector(".tile-value")).toBeNull();
  });

  it("a tile with value > 0 renders the value span", () => {
    const t = makeTile("Q", 6);
    const board = withTilePlaced(createEmptyBoard(), 7, 7, t, true);
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(7, 7)!;
    const valueSpan = c.querySelector(".tile-value");
    expect(valueSpan).not.toBeNull();
    expect(valueSpan?.textContent).toBe("6");
  });
});

describe("BoardView: tabIndex rules", () => {
  it("empty cells have tabIndex=0 when it's my turn", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(5, 5)!; // empty, non-bonus
    expect(c).toHaveAttribute("tabindex", "0");
  });

  it("empty cells have tabIndex=-1 when it's NOT my turn", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={false} />);
    const c = cell(5, 5)!;
    expect(c).toHaveAttribute("tabindex", "-1");
  });

  it("occupied cells have tabIndex=-1 even when it's my turn", () => {
    const t = makeTile("A", 1);
    const board = withTilePlaced(createEmptyBoard(), 5, 5, t, false);
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(5, 5)!;
    expect(c).toHaveAttribute("tabindex", "-1");
  });
});

describe("BoardView: click behavior", () => {
  it("clicking an empty cell during my turn calls onCellClick(row, col)", () => {
    const onClick = vi.fn();
    render(<BoardView board={createEmptyBoard()} onCellClick={onClick} isMyTurn={true} />);
    fireEvent.click(cell(3, 4)!);
    expect(onClick).toHaveBeenCalledWith(3, 4);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("clicking an occupied cell does NOT call onCellClick", () => {
    const onClick = vi.fn();
    const t = makeTile("A", 1);
    const board = withTilePlaced(createEmptyBoard(), 3, 4, t, false);
    render(<BoardView board={board} onCellClick={onClick} isMyTurn={true} />);
    fireEvent.click(cell(3, 4)!);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("clicking an empty cell when NOT my turn does NOT call onCellClick", () => {
    const onClick = vi.fn();
    render(<BoardView board={createEmptyBoard()} onCellClick={onClick} isMyTurn={false} />);
    fireEvent.click(cell(3, 4)!);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("BoardView: keyboard navigation", () => {
  it("Enter on a focused empty cell calls onCellClick", () => {
    const onClick = vi.fn();
    render(<BoardView board={createEmptyBoard()} onCellClick={onClick} isMyTurn={true} />);
    const c = cell(3, 4)!;
    c.focus();
    fireEvent.keyDown(c, { key: "Enter" });
    expect(onClick).toHaveBeenCalledWith(3, 4);
  });

  it("Space on a focused empty cell calls onCellClick", () => {
    const onClick = vi.fn();
    render(<BoardView board={createEmptyBoard()} onCellClick={onClick} isMyTurn={true} />);
    const c = cell(3, 4)!;
    c.focus();
    fireEvent.keyDown(c, { key: " " });
    expect(onClick).toHaveBeenCalledWith(3, 4);
  });

  it("Backspace on a newly-placed tile calls onCellClick", () => {
    const onClick = vi.fn();
    const t = makeTile("A", 1);
    const board = withTilePlaced(createEmptyBoard(), 3, 4, t, true);
    render(<BoardView board={board} onCellClick={onClick} isMyTurn={true} />);
    const c = cell(3, 4)!;
    c.focus();
    fireEvent.keyDown(c, { key: "Backspace" });
    expect(onClick).toHaveBeenCalledWith(3, 4);
  });

  it("ArrowDown moves focus to the cell below", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(3, 4)!;
    c.focus();
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: "ArrowDown" });
    expect(document.activeElement).toBe(cell(4, 4));
  });

  it("ArrowUp moves focus to the cell above", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(3, 4)!;
    c.focus();
    fireEvent.keyDown(c, { key: "ArrowUp" });
    expect(document.activeElement).toBe(cell(2, 4));
  });

  it("ArrowLeft moves focus to the cell to the left", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(3, 4)!;
    c.focus();
    fireEvent.keyDown(c, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cell(3, 3));
  });

  it("ArrowRight moves focus to the cell to the right", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(3, 4)!;
    c.focus();
    fireEvent.keyDown(c, { key: "ArrowRight" });
    expect(document.activeElement).toBe(cell(3, 5));
  });

  it("ArrowDown at the bottom edge (row 14) does NOT move focus", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(14, 4)!;
    c.focus();
    fireEvent.keyDown(c, { key: "ArrowDown" });
    expect(document.activeElement).toBe(c); // unchanged
  });

  it("ArrowRight at the right edge (col 14) does NOT move focus", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(4, 14)!;
    c.focus();
    fireEvent.keyDown(c, { key: "ArrowRight" });
    expect(document.activeElement).toBe(c); // unchanged
  });

  it("ArrowUp at the top edge (row 0) does NOT move focus", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(0, 4)!;
    c.focus();
    fireEvent.keyDown(c, { key: "ArrowUp" });
    expect(document.activeElement).toBe(c);
  });

  it("ArrowLeft at the left edge (col 0) does NOT move focus", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const c = cell(4, 0)!;
    c.focus();
    fireEvent.keyDown(c, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(c);
  });
});

describe("BoardView: full board + multiple tiles", () => {
  it("renders 225 gridcells even when every cell has a tile", () => {
    let board: Board = createEmptyBoard();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        board = withTilePlaced(board, r, c, makeTile("A", 1), false);
      }
    }
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(225);
  });

  it("multiple tiles on the board each have their own aria-label", () => {
    let board = createEmptyBoard();
    board = withTilePlaced(board, 0, 0, makeTile("C", 2), true);
    board = withTilePlaced(board, 7, 7, makeTile("A", 1), true);
    board = withTilePlaced(board, 14, 14, makeTile("Q", 6), true);
    render(<BoardView board={board} onCellClick={() => {}} isMyTurn={true} />);
    expect(cell(0, 0)!.getAttribute("aria-label")).toMatch(/peça C/);
    expect(cell(7, 7)!.getAttribute("aria-label")).toMatch(/peça A/);
    expect(cell(14, 14)!.getAttribute("aria-label")).toMatch(/peça Q/);
  });

  it("the grid label is announced only once (no duplicate '15 por 15' labels)", () => {
    render(<BoardView board={createEmptyBoard()} onCellClick={() => {}} isMyTurn={true} />);
    const grids = screen.getAllByRole("grid");
    expect(grids).toHaveLength(1);
  });
});
