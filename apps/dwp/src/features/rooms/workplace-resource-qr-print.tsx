import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Printer, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ActionButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import GlobalStyles from '@mui/material/GlobalStyles';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkplaceFloor, WorkplaceResource, WorkplaceSite } from '@dwp-frontend/shared-utils';

export function workplaceResourceQrTarget(
  origin: string,
  resource: WorkplaceResource,
  site: WorkplaceSite,
  floor: WorkplaceFloor
) {
  const search = new URLSearchParams({
    v: '1',
    sites: site.siteId,
    floors: floor.floorId,
    types: resource.type,
    resource: resource.resourceId,
  });
  return new URL(`/workplace/find?${search.toString()}`, origin).toString();
}

export function WorkplaceResourceQrPrint({
  resource,
  site,
  floor,
  disabled,
}: {
  resource: WorkplaceResource;
  site: WorkplaceSite;
  floor: WorkplaceFloor;
  disabled: boolean;
}) {
  const { t } = useTranslation('rooms');
  const [open, setOpen] = useState(false);
  const target = useMemo(
    () => workplaceResourceQrTarget(window.location.origin, resource, site, floor),
    [floor, resource, site]
  );
  const print = () => {
    document.body.classList.add('workplace-resource-qr-printing');
    try {
      window.print();
    } finally {
      document.body.classList.remove('workplace-resource-qr-printing');
    }
  };

  return (
    <>
      <ActionButton
        intent="secondary"
        startIcon={<QrCode size={17} />}
        disabled={disabled}
        onClick={() => setOpen(true)}
        sx={{ minHeight: 44 }}
      >
        {t('workplace.admin.locations.printQr')}
      </ActionButton>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="workplace-resource-qr-title"
        className="workplace-resource-qr-print-dialog"
      >
        <GlobalStyles
          styles={{
            '@media print': {
              'body.workplace-resource-qr-printing > #root': { visibility: 'hidden' },
              'body.workplace-resource-qr-printing .workplace-resource-qr-print-dialog': {
                visibility: 'visible',
              },
              'body.workplace-resource-qr-printing .workplace-resource-qr-print-dialog .MuiBackdrop-root, body.workplace-resource-qr-printing .workplace-resource-qr-print-dialog .MuiDialogActions-root': {
                display: 'none',
              },
              'body.workplace-resource-qr-printing .workplace-resource-qr-print-dialog .MuiDialog-container': {
                alignItems: 'flex-start',
              },
              'body.workplace-resource-qr-printing .workplace-resource-qr-print-dialog .MuiDialog-paper': {
                boxShadow: 'none',
                margin: 0,
                width: '100%',
              },
            },
          }}
        />
        <DialogTitle id="workplace-resource-qr-title">
          {t('workplace.admin.locations.qrTitle')}
        </DialogTitle>
        <DialogContent>
          <Stack
            data-testid="workplace-resource-qr-card"
            alignItems="center"
            gap={2}
            sx={{ py: 2, textAlign: 'center' }}
          >
            <QRCodeSVG
              value={target}
              size={220}
              level="M"
              marginSize={2}
              title={t('workplace.admin.locations.qrCodeLabel', { name: resource.name })}
            />
            <Box>
              <Typography component="h2" variant="h6">
                {resource.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {site.name} · {floor.name} · {resource.code}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {t('workplace.admin.locations.qrDescription')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton intent="quiet" onClick={() => setOpen(false)}>
            {t('actions.close')}
          </ActionButton>
          <ActionButton intent="primary" startIcon={<Printer size={17} />} onClick={print}>
            {t('workplace.admin.locations.print')}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
