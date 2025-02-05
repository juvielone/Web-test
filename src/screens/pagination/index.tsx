import Colors from "@/common/colors";
import Images from "@/common/images";
import Modal from "@/components/Modal";
import TextInput from "@/components/TextInput";
import useCollectionObserver from "@/hooks/useCollectionObserver";
import useKeyListener from "@/hooks/useKeyListener";
import { useAuth } from "@/services/context/AuthContext";
import { googleSignIn } from "@/services/firebase/auth";
import { createDocument, createId } from "@/services/firebase/firestore";
import { MessageType } from "@/types";
import { sanitizeString } from "@/utils/functions";
import { TSDate, UTCDate } from "@/utils/variables";
import React, { useCallback, useEffect, useRef, useState } from "react";
import MessageRow from "./components/MessageRow";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase/config";
import {
  orderBy,
  limit,
  startAfter,
  collection,
  QueryOrderByConstraint,
  QueryLimitConstraint,
  QueryConstraint,
  getFirestore,
  query,
  getDocs,
} from "firebase/firestore";

const Pagination = () => {
  const { Auth, logout } = useAuth();
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);

  const Messages = useCollectionObserver<MessageType>({
    Collection: "messages",
    Condition: [orderBy("createdAt", "desc"), limit(10)],
  });

  const [loading, setLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [messageChats, setMessageChats] = useState<MessageType[]>([]);

  const fetchMessages = useCallback(
    async (loadMore = false) => {
      if (loading || !hasMore) return;

      setLoading(true);

      try {
        let queryConstraints: QueryConstraint[] = [
          orderBy("createdAt", "desc") as QueryOrderByConstraint,
          limit(20) as QueryLimitConstraint,
        ];

        if (loadMore && lastDoc) {
          queryConstraints.push(startAfter(lastDoc));
        }

        //  query a reference
        const messagesRef = collection(getFirestore(), "messages");
        const queryRef = query(messagesRef, ...queryConstraints);
        //Get the docs
        const snapshot = await getDocs(queryRef);
        const newMessages = snapshot.docs.map(
          (doc) => doc.data() as MessageType
        );
        //If there no msg left set it to false
        if (newMessages.length === 0) {
          setHasMore(false);
        } else {
          setMessageChats((prev) => {
            // Prevent duplicate messages
            const uniqueMessages = [...prev, ...newMessages].filter(
              (msg, index, self) =>
                index === self.findIndex((m) => m.id === msg.id)
            );
            return uniqueMessages;
          });
          const docs = snapshot.docs;
          setLastDoc(docs[docs.length - 1]);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    },
    [hasMore, lastDoc, loading]
  );

  //Fetch messages at scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop } = e.currentTarget;

      if (scrollTop <= 0 && !loading && hasMore) {
        fetchMessages(true);
        console.log("scount: " + scrollTop);
      }
    },
    [fetchMessages, loading, hasMore]
  );

  useEffect(() => {
    if (Messages.length > 0) {
      setMessageChats(Messages);
      setLastDoc(Messages[Messages.length - 1]);
    }
  }, [Messages]);

  const sendMessage = useCallback(async () => {
    if (!Auth) return;
    const sanitized = sanitizeString(message);
    if (typeof message !== "string" || sanitized.trim() === "")
      return setMessageError(true);
    await createDocument<MessageType>({
      Collection: "messages",
      Data: {
        authorId: Auth.uid,
        createdAt: TSDate(),
        id: createId("messages"),
        message: sanitized,
      },
    });
    setMessage("");
  }, [message, Auth]);

  const handleSend = useCallback(async () => {
    if (!Auth)
      await googleSignIn().then((response) => {
        if (response.status !== 200) alert(response.message);
        else sendMessage();
      });
    else sendMessage();
  }, [Auth, sendMessage]);
  useKeyListener({
    key: "Enter",
    callback: handleSend,
    dependencies: [handleSend, Auth],
  });
  return (
    <>
      <div
        style={{
          background: Colors.black500,
          top: `${innerHeight / 4}px`,
          left: `calc(50% - 200px)`,
        }}
        className="m-auto br-15px card text-center w-400px h-min-400px h-50vh absolute col gap-5px"
      >
        <div
          onScroll={handleScroll}
          className="col-reverse gap-3px h-100p overflow-y-auto visible-scrollbar"
        >
          {loading && <div className="text-center p-2">Loading...</div>}
          {messageChats.map((msg) => (
            <MessageRow message={msg} key={msg.id} />
          ))}
        </div>

        {/* Text INPUT */}
        <div className="row-center">
          <TextInput
            value={message}
            setValue={(e) => {
              setMessage(e.target.value);
              if (messageError) setMessageError(false);
            }}
            error={messageError}
            inputClassName="bootstrap-input text-black"
            containerClassName="m-3px w-100p"
          />
          <button
            onClick={handleSend}
            className="h-30px w-30px"
            style={{ background: Colors.transparent }}
            type="button"
          >
            <img
              className="h-25px w-25px mr-3px"
              src={Images["ic_send_white"]}
            />
          </button>
        </div>
      </div>

      {Auth ? (
        <button
          style={{
            bottom: "100px",
            left: "calc(50% - 39px)",
            border: "1px solid " + Colors.white,
          }}
          onClick={logout}
          className="absolute br-3px pv-5px ph-15px"
          type="button"
        >
          Logout
        </button>
      ) : null}
    </>
  );
};

export default Pagination;
