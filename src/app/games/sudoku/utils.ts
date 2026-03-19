// 預設數獨題庫與產生器工具

type Grid = (number | null)[][];

// 預設的一個有效盤面解答
const BASE_SOLUTION: number[][] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

// 將完整的解答隨機挖空以建立題目
export function generateSudoku(difficulty: 'easy' | 'medium' | 'hard'): { puzzle: Grid, solution: number[][] } {
  // 為了產生變化，我們可以對 BASE_SOLUTION 進行數字映射替換 (例如 1 變 3, 3 變 1)
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  
  const mapNum = (n: number) => nums[n - 1];
  const solution = BASE_SOLUTION.map(row => row.map(mapNum));

  // 根據難度決定挖空數量
  const cellsToRemove = {
    easy: 30,
    medium: 45,
    hard: 55,
  }[difficulty];

  const puzzle: Grid = solution.map(row => [...row]);
  let removed = 0;

  while (removed < cellsToRemove) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] !== null) {
      puzzle[r][c] = null;
      removed++;
    }
  }

  return { puzzle, solution };
}

// 檢查是否違反規則
export function findErrors(grid: Grid): { r: number, c: number }[] {
  const errors: { r: number, c: number }[] = [];
  
  // Check rows and columns
  for (let i = 0; i < 9; i++) {
    const rowMap = new Map<number, number[]>();
    const colMap = new Map<number, number[]>();

    for (let j = 0; j < 9; j++) {
      const rVal = grid[i][j];
      if (rVal !== null) {
        if (!rowMap.has(rVal)) rowMap.set(rVal, []);
        rowMap.get(rVal)!.push(j);
      }

      const cVal = grid[j][i];
      if (cVal !== null) {
        if (!colMap.has(cVal)) colMap.set(cVal, []);
        colMap.get(cVal)!.push(j); // j is row index here
      }
    }

    rowMap.forEach((cols, val) => {
      if (cols.length > 1) {
        cols.forEach(c => errors.push({ r: i, c }));
      }
    });

    colMap.forEach((rows, val) => {
      if (rows.length > 1) {
        rows.forEach(r => errors.push({ r, c: i }));
      }
    });
  }

  // Check 3x3 blocks
  for (let blockR = 0; blockR < 3; blockR++) {
    for (let blockC = 0; blockC < 3; blockC++) {
      const blockMap = new Map<number, {r: number, c: number}[]>();
      
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const r = blockR * 3 + i;
          const c = blockC * 3 + j;
          const val = grid[r][c];
          if (val !== null) {
            if (!blockMap.has(val)) blockMap.set(val, []);
            blockMap.get(val)!.push({r, c});
          }
        }
      }

      blockMap.forEach((cells, val) => {
        if (cells.length > 1) {
          cells.forEach(cell => errors.push(cell));
        }
      });
    }
  }

  // 移除重複的錯誤座標
  return errors.filter((v, i, a) => a.findIndex(t => (t.r === v.r && t.c === v.c)) === i);
}

export function isGridFull(grid: Grid): boolean {
  return grid.every(row => row.every(cell => cell !== null));
}