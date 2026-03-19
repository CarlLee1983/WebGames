// 產生一個保證有解的隨機盤面
export function generateBoard(size: number, initialShuffles: number = 20): boolean[][] {
  const board = Array(size).fill(null).map(() => Array(size).fill(false));
  for (let i = 0; i < initialShuffles; i++) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    toggleLightsInPlace(board, r, c, size);
  }
  return board;
}

export function toggleLightsInPlace(board: boolean[][], r: number, c: number, size: number) {
  const directions = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dr, dc] of directions) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      board[nr][nc] = !board[nr][nc];
    }
  }
}

export function checkIsSolved(board: boolean[][]): boolean {
  return board.every(row => row.every(cell => cell === false));
}

/**
 * 使用高斯消去法求解 Lights Out (GF(2) 線性系統)
 * 回傳一個 boolean[][]，代表哪些格子需要被點擊一次。
 */
export function solveLightsOut(board: boolean[][], size: number): boolean[][] | null {
  const N = size * size;
  const matrix: number[][] = Array(N).fill(null).map(() => Array(N + 1).fill(0));

  // 1. 建立增廣矩陣 A|b
  // A_ij = 1 代表點擊 j 會影響 i
  // b_i = 1 代表 i 目前是亮的
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      matrix[i][N] = board[r][c] ? 1 : 0; // 常數項 b

      const directions = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const j = nr * size + nc;
          matrix[i][j] = 1;
        }
      }
    }
  }

  // 2. 高斯消去法 (Gaussian Elimination over GF(2))
  let pivot = 0;
  for (let j = 0; j < N && pivot < N; j++) {
    let sel = pivot;
    while (sel < N && matrix[sel][j] === 0) sel++;
    if (sel === N) continue;

    [matrix[pivot], matrix[sel]] = [matrix[sel], matrix[pivot]];

    for (let i = 0; i < N; i++) {
      if (i !== pivot && matrix[i][j] === 1) {
        for (let k = j; k <= N; k++) {
          matrix[i][k] ^= matrix[pivot][k];
        }
      }
    }
    pivot++;
  }

  // 3. 提取解答
  const result = Array(size).fill(null).map(() => Array(size).fill(false));
  for (let i = 0; i < N; i++) {
    // 檢查是否有矛盾 (0 = 1)
    let allZeros = true;
    for (let j = 0; j < N; j++) if (matrix[i][j] !== 0) allZeros = false;
    if (allZeros && matrix[i][N] !== 0) return null; // 無解

    // 尋找 pivot
    for (let j = 0; j < N; j++) {
      if (matrix[i][j] === 1) {
        const r = Math.floor(j / size);
        const c = j % size;
        result[r][c] = matrix[i][N] === 1;
        break;
      }
    }
  }

  return result;
}