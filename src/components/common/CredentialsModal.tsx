import { Check, Clipboard, X } from 'lucide-react';
import React, { useState } from 'react';

interface CredentialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role: string;
}

export const CredentialsModal: React.FC<CredentialsModalProps> = ({
    isOpen,
    onClose,
    email,
    password,
    firstName,
    lastName,
    role,
}) => {
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [copiedPassword, setCopiedPassword] = useState(false);

    if (!isOpen) return null;

    const handleCopy = (text: string, setCopied: (val: boolean) => void) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 print:bg-white print:absolute print:inset-0">
            <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl print:shadow-none print:w-full print:max-w-none">
                <div className="flex items-center justify-between mb-6 print:hidden">
                    <h3 className="text-xl font-semibold text-[#363f49]">User Credentials Created</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="print:block hidden mb-4">
                    <h1 className="text-2xl font-bold">BuckLive User Credentials</h1>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 print:border-none print:bg-white print:p-0">
                    <p className="text-green-800 text-sm mb-2 print:text-black">
                        The user account has been successfully created. Please save these credentials securely.
                    </p>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1 text-sm font-medium text-gray-500">Name:</div>
                        <div className="col-span-2 text-sm font-semibold text-gray-900">{firstName} {lastName}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1 text-sm font-medium text-gray-500">Role:</div>
                        <div className="col-span-2 text-sm font-semibold text-gray-900 capitalize">{role.replace('_', ' ')}</div>
                    </div>

                    <div className="border-t border-gray-200 my-4 pt-4">
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Email / Username</label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono text-gray-800 border border-gray-200 print:border-black">
                                    {email}
                                </code>
                                <button
                                    onClick={() => handleCopy(email, setCopiedEmail)}
                                    className="p-2 text-gray-500 hover:text-brand-primary print:hidden"
                                    title="Copy Email"
                                >
                                    {copiedEmail ? <Check className="h-4 w-4 text-green-600" /> : <Clipboard className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {password && (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Password</label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono text-gray-800 border border-gray-200 print:border-black">
                                        {password}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(password!, setCopiedPassword)}
                                        className="p-2 text-gray-500 hover:text-brand-primary print:hidden"
                                        title="Copy Password"
                                    >
                                        {copiedPassword ? <Check className="h-4 w-4 text-green-600" /> : <Clipboard className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 print:hidden">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
