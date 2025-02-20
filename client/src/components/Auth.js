import React, { useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const AuthContainer = styled.div`
  max-width: 400px;
  margin: 40px auto;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  background: white;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
`;

const Button = styled.button`
  padding: 10px;
  background: #0095f6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  
  &:hover {
    background: #0081d6;
  }
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  color: #0095f6;
  cursor: pointer;
  margin-top: 10px;
  
  &:hover {
    text-decoration: underline;
  }
`;

const ErrorMessage = styled.div`
  color: red;
  margin-top: 10px;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 4px;
`;

function Auth({ onAuthSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: ''
    });

    // axios
    axios.defaults.withCredentials = true;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            const response = await axios.post(endpoint, formData);

            if (response.data.user) {
                onAuthSuccess(response.data.user);
            } else {
                setError('Something went wrong');
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Something went wrong, please try again later');
        }
    };

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    return (
        <AuthContainer>
            <h2>{isLogin ? 'login' : 'register'}</h2>
            <Form onSubmit={handleSubmit}>
                <Input
                    type="text"
                    name="username"
                    placeholder="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                />

                {!isLogin && (
                    <Input
                        type="email"
                        name="email"
                        placeholder="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                )}

                <Input
                    type="password"
                    name="password"
                    placeholder="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                />

                <Button type="submit">
                    {isLogin ? 'login' : 'register'}
                </Button>
            </Form>

            <ToggleButton onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? 'no account? register' : 'have an account? login'}
            </ToggleButton>

            {error && <ErrorMessage>{error}</ErrorMessage>}
        </AuthContainer>
    );
}

export default Auth; 