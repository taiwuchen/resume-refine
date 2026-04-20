export async function readErrorDetail(response: Response, fallbackMessage: string): Promise<string> {
    try {
        const error = await response.json();
        return error.detail || fallbackMessage;
    } catch {
        return fallbackMessage;
    }
}
