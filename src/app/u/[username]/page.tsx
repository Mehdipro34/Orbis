import type {Metadata} from "next";
import {ProfileView} from "@/components/profile-view";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{username:string}>}):Promise<Metadata> {
  const {username}=await params;
  return {title:"@"+username+" — профиль"};
}

export default async function ProfilePage({params}:{params:Promise<{username:string}>}) {
  const {username}=await params;
  return <ProfileView username={username}/>;
}
