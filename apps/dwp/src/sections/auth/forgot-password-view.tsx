import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const ForgotPasswordView = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);

      if (!email) {
        setErrorMessage('이메일 주소를 입력해주세요.');
        return;
      }

      // TODO: 실제 비밀번호 재설정 API 호출
      // 현재는 시뮬레이션
      try {
        // await resetPasswordApi({ email });
        setIsSubmitted(true);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : '비밀번호 재설정 요청에 실패했습니다.');
      }
    },
    [email]
  );

  if (isSubmitted) {
    return (
      <Box
        sx={{
          gap: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 420,
          mx: 'auto',
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'success.lighter',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <Iconify icon="solar:check-circle-bold" width={32} sx={{ color: 'success.main' }} />
        </Box>

        <Typography variant="h5">이메일을 확인해주세요</Typography>

        <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
          비밀번호 재설정 링크를 <strong>{email}</strong>로 전송했습니다.
          <br />
          이메일을 확인하고 링크를 클릭하여 비밀번호를 재설정하세요.
        </Typography>

        <Button
          fullWidth
          size="large"
          variant="contained"
          onClick={() => navigate('/sign-in')}
          sx={{ mt: 2 }}
        >
          로그인으로 돌아가기
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          gap: 1.5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mb: 5,
        }}
      >
        <Typography variant="h5">비밀번호 찾기</Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            textAlign: 'center',
          }}
        >
          가입하신 이메일 주소를 입력하시면
          <br />
          비밀번호 재설정 링크를 보내드립니다.
        </Typography>
      </Box>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {!!errorMessage && (
          <Alert severity="error" variant="outlined">
            {errorMessage}
          </Alert>
        )}

        <TextField
          fullWidth
          name="email"
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
          }}
        />

        <Button fullWidth size="large" type="submit" variant="contained" color="inherit">
          재설정 링크 보내기
        </Button>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Link component={RouterLink} href="/sign-in" variant="body2" color="inherit">
            로그인으로 돌아가기
          </Link>
        </Box>
      </Box>
    </>
  );
};
