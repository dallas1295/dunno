import { User, UserProfile } from "@/models/user";
import { UserRepo } from "@/repositories/user";
import { validatePassword, validateEmail } from "@/utils/user";
import { generateRecoveryCodes } from "@/utils/recovery";
import { verifyTOTP } from "@/utils/totp";
import { hashPassword, verifyPassword } from "@/services/password";
import QRCode from "qrcode";
import * as OTPAuth from "otpauth";
import { ErrorCounter } from "@/utils/otel";
import { ChangeRateLimit } from "@/utils/rateLimit";
import "dotenv/config";

export class UserService {
  constructor(private userRepo: UserRepo) {}

  async createUser(
    username: string,
    email: string,
    password: string,
  ): Promise<User> {
    if (!validatePassword(password)) {
      throw new Error(
        "Password must have at least 2 special characters, 2 numbers, and be at least 8 characters long",
      );
    }
    if (!validateEmail(email)) {
      throw new Error("Must be a valid email");
    }
    try {
      const userNameExists = await this.userRepo.findByUsername(username);
      if (userNameExists) {
        throw new Error("Username already exists");
      }
      const emailExists = await this.userRepo.findByEmail(email);
      if (emailExists) {
        throw new Error("Email already in use");
      }

      const hashedPassword = await hashPassword(password);

      const newUser: User = {
        userId: crypto.randomUUID(),
        username,
        passwordHash: hashedPassword,
        createdAt: new Date(),
        email,
        twoFactorEnabled: false,
      };

      const createdUser = await this.userRepo.createUser(newUser);
      return createdUser;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "create_user",
      });
      console.error("Error creating user");
      throw error;
    }
  }

  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const exists = await this.userRepo.findById(userId);
      if (!exists) {
        throw new Error("User not found");
      }

      const userProfile: UserProfile = {
        username: exists.username,
        email: exists.email,
        createdAt: exists.createdAt,
      };

      return userProfile;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "get_user_profile",
      });
      console.error("Error getting user profile");
      throw error;
    }
  }

  async changePassword(
    userId: string,
    newPassword: string,
    oldPassword: string,
  ): Promise<boolean> {
    try {
      const exists = await this.userRepo.findById(userId);

      if (!exists) {
        throw new Error("User not found");
      }

      if (exists.lastPasswordChange) {
        const twoWeeks = 14 * 24 * 60 * 60 * 1000;
        const timeSinceChange =
          Date.now() - exists.lastPasswordChange.getTime();
        const timeRemaining = Math.max(0, twoWeeks - timeSinceChange);

        if (timeRemaining > 0) {
          const nextAllowed = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
          throw new ChangeRateLimit(nextAllowed);
        }
      }

      if (!(await verifyPassword(exists.passwordHash, oldPassword))) {
        throw new Error("Old password is incorrect");
      } else if (!validatePassword(newPassword)) {
        throw new Error(
          "New password must have at least 2 special characters, 2 numbers, and be at least 8 characters long",
        );
      }

      const hashedPassword = await hashPassword(newPassword);

      const result = await this.userRepo.updateUserPassword(
        userId,
        hashedPassword,
      );

      if (!result) {
        return false;
      }

      return true;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "change_password",
      });
      console.error("Error changing password");
      throw error;
    }
  }

  async findById(userId: string): Promise<User | null> {
    try {
      return await this.userRepo.findById(userId);
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "find_by_id",
      });
      console.error("Error finding user by id");
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.userRepo.findByEmail(email);
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "find_by_email",
      });
      console.error("Error finding user by email");
      throw error;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      return await this.userRepo.findByUsername(username);
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "find_by_username",
      });
      console.error("Error finding user by username");
      throw error;
    }
  }

  async updateUsername(
    userId: string,
    oldName: string,
    newName: string,
  ): Promise<User | null> {
    try {
      const exists = await this.userRepo.findById(userId);
      if (!exists) {
        throw new Error("User not found");
      }
      if (!newName || newName.trim() === "") {
        throw new Error("Must provide new username");
      } else if (newName.trim() === oldName.trim()) {
        throw new Error("You are already using this username");
      }

      if (exists.lastUsernameChange) {
        const twoWeeks = 14 * 24 * 60 * 60 * 1000;
        const timeSinceChange =
          Date.now() - exists.lastUsernameChange.getTime();
        const timeRemaining = Math.max(0, twoWeeks - timeSinceChange);

        if (timeRemaining > 0) {
          throw new Error(
            `Username can only be changed every 2 weeks. Time remaining: ${Math.ceil(
              timeRemaining / (24 * 60 * 60 * 1000),
            )} days`,
          );
        }
      }

      const nameUsed = await this.userRepo.findByUsername(newName);

      if (nameUsed) {
        throw new Error("This username is already in use");
      }

      return await this.userRepo.updateUsernameById(userId, {
        username: newName.trim(),
      } as User);
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "change_username",
      });
      console.error("Error updating username");
      throw error;
    }
  }

  async updateEmail(userId: string, newEmail: string): Promise<boolean> {
    try {
      const exists = await this.userRepo.findById(userId);
      if (!exists) {
        throw new Error("User not found");
      }

      if (exists.lastEmailChange) {
        const twoWeeks = 14 * 24 * 60 * 60 * 1000;
        const timeSinceChange = Date.now() - exists.lastEmailChange.getTime();
        const timeRemaining = Math.max(0, twoWeeks - timeSinceChange);

        if (timeRemaining > 0) {
          const nextAllowed = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
          throw new ChangeRateLimit(nextAllowed);
        }
      }

      if (exists.email.trim() === newEmail.trim()) {
        throw new Error("You are already using this email");
      }

      if (!validateEmail(newEmail)) {
        throw new Error("Must be a valid email addresss");
      }

      const result = await this.userRepo.updateUserEmail(userId, newEmail);

      if (!result) {
        return false;
      }

      return true;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "change_email",
      });
      console.error("Error updating email");
      throw error;
    }
  }

  async enableTwoFactor(
    userId: string,
  ): Promise<{ qrCode: string; uri: string; secret: string }> {
    try {
      const exists = await this.userRepo.findById(userId);

      if (!exists) {
        throw new Error("User not found");
      } else if (exists.twoFactorEnabled) {
        throw new Error("Two factor is already enabled");
      }

      const secret = new OTPAuth.Secret({ size: 32 });
      const totp = new OTPAuth.TOTP({
        issuer: "dunNotes",
        label: "dunnoAuth",
        algorithm: "SHA512",
        digits: 6,
        period: 30,
        secret: secret.base32,
      });

      const uri = OTPAuth.URI.stringify(totp);
      const qrSvg = await QRCode.toString(uri, { type: "svg" });
      await this.userRepo.enableTwoFactor(userId, secret.base32, []);

      return {
        qrCode: qrSvg,
        uri: uri,
        secret: secret.base32,
      };
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "enable_two_factor",
      });
      console.error("Error enabling two factor");
      throw error;
    }
  }

  async verifyTwoFactor(
    userId: string,
    token: string,
  ): Promise<{ verified: boolean; recoveryCodes: string[] }> {
    try {
      const exists = await this.userRepo.findById(userId);
      if (!exists) {
        throw new Error("User not found");
      }

      if (!exists.twoFactorSecret) {
        throw new Error("Two factor setup not started");
      }

      const totp = new OTPAuth.TOTP({
        issuer: "dunNotes",
        label: "dunnoAuth",
        algorithm: "SHA512",
        digits: 6,
        period: 30,
        secret: exists.twoFactorSecret,
      });

      const validToken = totp.validate({ token }); //NOTE: could add window: 1 to make looser if necessary
      if (validToken === null) {
        throw new Error("Invalid verification code");
      }

      const recoveryCodes = generateRecoveryCodes();

      await this.userRepo.enableTwoFactor(
        userId,
        exists.twoFactorSecret,
        recoveryCodes,
        true,
      );

      return { verified: true, recoveryCodes };
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "verify_two_factor",
      });
      console.error("Error verifying two factor setup");
      throw error;
    }
  }

  async disableTwoFactor(
    userId: string,
    totp: string,
    password: string,
  ): Promise<boolean> {
    try {
      const exists = await this.userRepo.findById(userId);
      if (!exists) {
        throw new Error("User not found");
      }

      if (exists.twoFactorEnabled === false) {
        throw new Error("Two factor cannot be disable (not enabled)");
      }

      const verifiedPassword = await verifyPassword(
        exists.passwordHash,
        password,
      );
      if (!verifiedPassword) {
        throw new Error("Invalid password");
      }

      const verifiedTotp = verifyTOTP(
        OTPAuth.Secret.fromBase32(exists.twoFactorSecret!),
        totp,
      );
      if (!verifiedTotp) {
        throw new Error("OTP cannot be verified");
      }

      await this.userRepo.disableTwoFactor(userId);

      return true;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "disable_two_factor",
      });
      console.error("Error disabling two factor");
      throw error;
    }
  }

  async deleteUser(userId: string, passwordOnce: string): Promise<void> {
    try {
      const exists = await this.userRepo.findById(userId);
      if (!exists) {
        throw new Error("User not found");
      }

      const verifiedPasswordOnce = await verifyPassword(
        exists.passwordHash,
        passwordOnce,
      );

      if (!verifiedPasswordOnce) {
        throw new Error("Invalid password");
      }

      return await this.userRepo.deleteUserById(userId);
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "delete_user",
      });
      console.error("Error deleting user");
      throw error;
    }
  }

  async useRecoveryCode(
    userId: string,
    recoveryCode: string,
  ): Promise<boolean> {
    try {
      const exists = await this.userRepo.findById(userId);
      if (!exists) {
        throw new Error("User not found");
      }

      if (!exists.recoveryCodes || exists.recoveryCodes.length === 0) {
        throw new Error("Recovery authentication not available");
      }

      if (!recoveryCode) {
        throw new Error("No code provided");
      }

      const used = recoveryCode.trim();

      if (exists.recoveryCodes?.includes(used)) {
        const updatedCodes = exists.recoveryCodes.filter(
          (remaining) => remaining !== used,
        );
        await this.userRepo.updateUserRecoveryCodes(
          exists.userId,
          updatedCodes,
        );
        return true;
      }

      return false;
    } catch (error) {
      ErrorCounter.add(1, {
        type: "UserService",
        operation: "user_recovery",
      });
      console.error("Error using recovery code");
      throw error;
    }
  }
}
