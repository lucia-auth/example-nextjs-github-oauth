import { generateSessionToken, createSession, setSessionTokenCookie } from "@/lib/server/session";
import { github } from "@/lib/server/oauth";
import { cookies } from "next/headers";
import { createUser, getUserFromGitHubId } from "@/lib/server/user";
import { ObjectParser } from "@pilcrowjs/object-parser";
import { globalGETRateLimit } from "@/lib/server/request";

import type { OAuth2Tokens } from "arctic";

export async function GET(request: Request): Promise<Response> {
    if (!globalGETRateLimit()) {
		return new Response("Too many requests", {
            status: 429
        }) 
	}
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const storedState = cookies().get("github_oauth_state")?.value ?? null;
	if (code === null || state === null || storedState === null) {
		return new Response("Please restart the process.", {
			status: 400
		});
	}
	if (state !== storedState) {
		return new Response("Please restart the process.", {
			status: 400
		});
	}

	let tokens: OAuth2Tokens;
	try {
		tokens = await github.validateAuthorizationCode(code);
	} catch {
		// Invalid code or client credentials
		return new Response("Please restart the process.", {
			status: 400
		});
	}
	const githubAccessToken = tokens.accessToken();

	const userRequest = new Request("https://api.github.com/user");
	userRequest.headers.set("Authorization", `Bearer ${githubAccessToken}`);
	const userResponse = await fetch(userRequest);
	const userResult: unknown = await userResponse.json();
	const userParser = new ObjectParser(userResult);

	const githubUserId = userParser.getNumber("id");
	const username = userParser.getString("login");

	const existingUser = getUserFromGitHubId(githubUserId);
	if (existingUser !== null) {
		const sessionToken = generateSessionToken();
		const session = createSession(sessionToken, existingUser.id);
		setSessionTokenCookie(sessionToken, session.expiresAt);
		return new Response(null, {
			status: 302,
			headers: {
				Location: "/"
			}
		});
	}

	const emailListRequest = new Request("https://api.github.com/user/emails");
	emailListRequest.headers.set("Authorization", `Bearer ${githubAccessToken}`);
	const emailListResponse = await fetch(emailListRequest);
	const emailListResult: unknown = await emailListResponse.json();
	if (!Array.isArray(emailListResult) || emailListResult.length < 1) {
		return new Response("Please restart the process.", {
			status: 400
		});
	}
	let email: string | null = null;
	for (const emailRecord of emailListResult) {
		const emailParser = new ObjectParser(emailRecord);
		const primaryEmail = emailParser.getBoolean("primary");
		const verifiedEmail = emailParser.getBoolean("verified");
		if (primaryEmail && verifiedEmail) {
			email = emailParser.getString("email");
		}
	}
	if (email === null) {
		return new Response("Please verify your GitHub email address.", {
			status: 400
		});
	}

	const user = createUser(githubUserId, email, username);
	const sessionToken = generateSessionToken();
	const session = createSession(sessionToken, user.id);
	setSessionTokenCookie(sessionToken, session.expiresAt);
	return new Response(null, {
		status: 302,
		headers: {
			Location: "/"
		}
	});
}
