/** Signed-in but the token isn't minted yet is transient — throw so React Query retries. */
export async function requireToken(
  getToken: () => Promise<string | null>,
): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error('Session token not ready');
  return token;
}
