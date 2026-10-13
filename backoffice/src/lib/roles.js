// Nombres en español de los roles, para todo lo que se ve. El valor interno
// (`carrier_company`, etc.) no cambia: está guardado en cada usuario, viaja en
// el token de sesión y las dos APIs dan permisos con él.
export const ROLE_LABELS = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  // Mudanzas, embalaje o armado: qué hace se marca en la empresa, no en el rol.
  carrier_company: 'Empresa',
  real_estate_agent: 'Agente inmobiliario',
}

export const ROLES = Object.keys(ROLE_LABELS)

export const roleLabel = (role) => ROLE_LABELS[role] || role
