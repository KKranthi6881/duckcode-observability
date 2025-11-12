export const getProviderDisplayName = (providerType?: string | null, providerLabel?: string | null) => {
  if (providerLabel && providerLabel.trim().length > 0) {
    return providerLabel;
  }

  switch (providerType) {
    case 'okta':
      return 'Okta';
    case 'azure_ad':
      return 'Microsoft Entra ID';
    case 'saml':
      return 'SAML';
    case 'oidc':
      return 'OIDC';
    default:
      return 'Enterprise SSO';
  }
};
