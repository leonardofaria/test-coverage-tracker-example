export const divide = (numerator, denominator) => {
  if (denominator === 0) {
    throw new Error('Division by zero is not allowed');
  }

  return numerator / denominator;
}