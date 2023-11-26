import React, { useState } from 'react';
import { Container, Form, Button } from 'react-bootstrap';
import { db } from '../firebaseConfig'; // Ensure this path is correct
import { collection, addDoc } from 'firebase/firestore';

const Contact = () => {
  // State hooks to store form field values
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Use addDoc from 'firebase/firestore' to add a document to the 'messages' collection
      await addDoc(collection(db, "messages"), {
        email: email,
        message: message,
        createdAt: new Date()
      });
      alert('Message has been submitted!');
      // Reset form fields after submission
      setEmail('');
      setMessage('');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <Container id='contact' className="my-5">
      <h3>contact me</h3>
      <Form onSubmit={handleSubmit}>
        <Form.Group controlId="formBasicEmail">
          <Form.Label>email address</Form.Label>
          <Form.Control 
            type="email" 
            placeholder="enter email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Form.Group>

        <Form.Group controlId="formBasicMessage">
          <Form.Label>message</Form.Label>
          <Form.Control 
            as="textarea" 
            rows={3} 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Form.Group>

        <Button variant="primary" type="submit">
          Send
        </Button>
      </Form>
    </Container>
  );
};

export default Contact;
