import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "../test-utils/test-instance";
import { OAuth2Tokens } from "arctic";
import { createJWT } from "oslo/jwt";
import { DEFAULT_SECRET } from "../utils/constants";
import type { GoogleProfile } from "./google";
import { parseSetCookieHeader } from "../cookies";

vi.mock("./utils", async (importOriginal) => {
	const original = (await importOriginal()) as any;
	return {
		...original,
		validateAuthorizationCode: vi
			.fn()
			.mockImplementation(async (...args: any) => {
				const data: GoogleProfile = {
					email: "user@email.com",
					email_verified: true,
					name: "First Last",
					picture: "https://lh3.googleusercontent.com/a-/AOh14GjQ4Z7Vw",
					exp: 1234567890,
					sub: "1234567890",
					iat: 1234567890,
					aud: "test",
					azp: "test",
					nbf: 1234567890,
					iss: "test",
					locale: "en",
					jti: "test",
					given_name: "First",
					family_name: "Last",
				};
				const testIdToken = await createJWT(
					"HS256",
					Buffer.from(DEFAULT_SECRET),
					data,
				);
				const tokens = new OAuth2Tokens({
					access_token: "test",
					refresh_token: "test",
					id_token: testIdToken,
				});
				return tokens;
			}),
	};
});

describe("Social Providers", async () => {
	const { auth, customFetchImpl, client } = await getTestInstance({
		socialProviders: {
			google: {
				clientId: "test",
				clientSecret: "test",
				enabled: true,
			},
			apple: {
				clientId: "test",
				clientSecret: "test",
			},
		},
	});
	let state = "";
	it("should be able to add social providers", async () => {
		const signInRes = await client.signIn.social({
			provider: "google",
		});
		expect(signInRes.data).toMatchObject({
			url: expect.stringContaining("google.com"),
			state: expect.any(String),
			codeVerifier: expect.any(String),
			redirect: true,
		});
		state = signInRes.data?.state || "";
	});

	it("should be able to sign in with social providers", async () => {
		await client.$fetch("/callback/google", {
			query: {
				state,
				code: "test",
			},
			method: "GET",
			onError(context) {
				expect(context.response.status).toBe(302);
				const cookies = parseSetCookieHeader(
					context.response.headers.get("set-cookie") || "",
				);
				expect(cookies.get("better-auth.session_token")?.value).toBeDefined();
			},
		});
	});
});
